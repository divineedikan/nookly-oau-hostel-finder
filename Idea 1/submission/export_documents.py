from __future__ import annotations

import html
import re
import textwrap
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPORT_MD = ROOT / "report" / "Nookly_Project_Report.md"
SLIDES_MD = ROOT / "presentation" / "Nookly_Presentation_Slides.md"


def read_markdown(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def plain_text(line: str) -> str:
    line = re.sub(r"`([^`]+)`", r"\1", line)
    line = re.sub(r"\*\*([^*]+)\*\*", r"\1", line)
    line = re.sub(r"\*([^*]+)\*", r"\1", line)
    line = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line)
    return line.strip()


def markdown_blocks(lines: list[str]) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []
    in_code = False
    code: list[str] = []
    table: list[str] = []
    para: list[str] = []

    def flush_para() -> None:
        nonlocal para
        if para:
            blocks.append(("p", " ".join(plain_text(x) for x in para).strip()))
            para = []

    def flush_table() -> None:
        nonlocal table
        if table:
            cleaned = [plain_text(row).strip("|").replace("|", " | ") for row in table if "---" not in row]
            if cleaned:
                blocks.append(("table", "\n".join(cleaned)))
            table = []

    for line in lines:
        raw = line.rstrip()
        if raw.startswith("```"):
            if in_code:
                blocks.append(("code", "\n".join(code)))
                code = []
                in_code = False
            else:
                flush_para()
                flush_table()
                in_code = True
            continue
        if in_code:
            code.append(raw)
            continue
        if raw.startswith("|"):
            flush_para()
            table.append(raw)
            continue
        flush_table()
        if not raw.strip():
            flush_para()
            continue
        if raw.startswith("#"):
            flush_para()
            level = len(raw) - len(raw.lstrip("#"))
            blocks.append((f"h{min(level, 3)}", plain_text(raw.lstrip("#").strip())))
        elif raw.lstrip().startswith("- "):
            flush_para()
            blocks.append(("li", plain_text(raw.lstrip()[2:])))
        elif re.match(r"^\d+\.\s+", raw):
            flush_para()
            blocks.append(("li", plain_text(re.sub(r"^\d+\.\s+", "", raw))))
        else:
            para.append(raw)
    flush_para()
    flush_table()
    return [(kind, text) for kind, text in blocks if text]


def make_docx(markdown: Path, output: Path) -> None:
    blocks = markdown_blocks(read_markdown(markdown))

    def p(text: str, style: str | None = None) -> str:
        style_xml = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
        return f"<w:p>{style_xml}<w:r><w:t xml:space=\"preserve\">{html.escape(text)}</w:t></w:r></w:p>"

    body = []
    for kind, text in blocks:
        if kind == "h1":
            body.append(p(text, "Title"))
        elif kind == "h2":
            body.append(p(text, "Heading1"))
        elif kind == "h3":
            body.append(p(text, "Heading2"))
        elif kind == "li":
            body.append(p(f"- {text}"))
        elif kind == "code":
            for row in text.splitlines():
                body.append(p(row))
        else:
            for row in text.splitlines():
                body.append(p(row))

    document = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(body)}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>"""
    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
</w:styles>"""
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""
    doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document)
        z.writestr("word/styles.xml", styles)
        z.writestr("word/_rels/document.xml.rels", doc_rels)


def pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def make_pdf(markdown: Path, output: Path) -> None:
    blocks = markdown_blocks(read_markdown(markdown))
    lines: list[str] = []
    for kind, text in blocks:
        width = 70 if kind not in {"h1", "h2", "h3"} else 54
        prefix = "- " if kind == "li" else ""
        for part in text.splitlines():
            lines.extend(textwrap.wrap(prefix + part, width=width) or [""])
        lines.append("")

    pages = [lines[i:i + 45] for i in range(0, len(lines), 45)] or [[]]
    objects: list[str] = ["<< /Type /Catalog /Pages 2 0 R >>"]
    kids = []
    font_id = 3 + len(pages) * 2
    for i, page_lines in enumerate(pages):
        page_obj = 3 + i * 2
        content_obj = page_obj + 1
        kids.append(f"{page_obj} 0 R")
        text_ops = ["BT", "/F1 11 Tf", "50 780 Td", "14 TL"]
        for line in page_lines:
            text_ops.append(f"({pdf_escape(line)}) Tj")
            text_ops.append("T*")
        text_ops.append("ET")
        stream = "\n".join(text_ops)
        objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_obj} 0 R >>")
        objects.append(f"<< /Length {len(stream.encode('latin-1', 'replace'))} >>\nstream\n{stream}\nendstream")
    objects.insert(1, f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(pages)} >>")
    objects.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    pdf = ["%PDF-1.4\n"]
    offsets = []
    for index, obj in enumerate(objects, 1):
        offsets.append(sum(len(x.encode("latin-1", "replace")) for x in pdf))
        pdf.append(f"{index} 0 obj\n{obj}\nendobj\n")
    xref_offset = sum(len(x.encode("latin-1", "replace")) for x in pdf)
    pdf.append(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n")
    for off in offsets:
        pdf.append(f"{off:010d} 00000 n \n")
    pdf.append(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF")
    output.write_bytes("".join(pdf).encode("latin-1", "replace"))


def parse_slides(path: Path) -> list[tuple[str, list[str]]]:
    slides: list[tuple[str, list[str]]] = []
    title = "Nookly"
    body: list[str] = []
    for line in read_markdown(path):
        if line.startswith("## "):
            if body or title != "Nookly":
                slides.append((title, body))
            title = plain_text(line[3:])
            body = []
        elif line.startswith("# "):
            title = plain_text(line[2:])
        elif line.strip() and not line.startswith("```"):
            body.append(plain_text(line.lstrip("- ")))
    if body or title:
        slides.append((title, body))
    return slides[:20]


def make_pptx(markdown: Path, output: Path) -> None:
    slides = parse_slides(markdown)
    slide_xml = []
    rels_xml = []
    overrides = []

    for idx, (title, body) in enumerate(slides, 1):
        body_text = "\n".join(body[:9])
        slide = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="274320"/><a:ext cx="8229600" cy="685800"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="3400" b="1"/><a:t>{html.escape(title)}</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1219200"/><a:ext cx="7772400" cy="5029200"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>{''.join(f'<a:p><a:r><a:rPr sz="2000"/><a:t>{html.escape(line)}</a:t></a:r></a:p>' for line in body_text.splitlines())}</p:txBody></p:sp>
  </p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>"""
        slide_xml.append((f"ppt/slides/slide{idx}.xml", slide))
        rels_xml.append((f"ppt/slides/_rels/slide{idx}.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'))
        overrides.append(f'<Override PartName="/ppt/slides/slide{idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>')

    sld_ids = "".join(f'<p:sldId id="{256+i}" r:id="rId{i}"/>' for i in range(1, len(slides)+1))
    pres = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:sldSz cx="9144000" cy="5143500" type="screen16x9"/><p:sldIdLst>{sld_ids}</p:sldIdLst></p:presentation>"""
    pres_rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + "".join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>' for i in range(1, len(slides)+1)) + "</Relationships>"
    content_types = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
{''.join(overrides)}
</Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>"""

    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("ppt/presentation.xml", pres)
        z.writestr("ppt/_rels/presentation.xml.rels", pres_rels)
        for name, xml in slide_xml + rels_xml:
            z.writestr(name, xml)


def main() -> None:
    make_docx(REPORT_MD, ROOT / "report" / "Nookly_Project_Report.docx")
    make_pdf(REPORT_MD, ROOT / "report" / "Nookly_Project_Report.pdf")
    make_pptx(SLIDES_MD, ROOT / "presentation" / "Nookly_Presentation.pptx")
    make_pdf(SLIDES_MD, ROOT / "presentation" / "Nookly_Presentation.pdf")
    print("Exported report DOCX/PDF and presentation PPTX/PDF.")


if __name__ == "__main__":
    main()
