"""Extract role metadata (name, origin, description) from the SVG cards.

Contract:
- Input: SVG files in ../roles/*.svg
- Output: JSON printed to stdout (list of dicts)

Extraction rules:
- role name: <text id="role">...</text>
- origin: <text id="origine">...</text>
- description: <text id="descText"> contains several <tspan> lines. We extract the visible text.

This repo's SVGs are simple enough that a lightweight XML parse is sufficient.
"""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

SVG_NS = "{http://www.w3.org/2000/svg}"


def _strip(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _text_content(el: ET.Element) -> str:
    # Collect text + all descendants' text.
    parts: list[str] = []

    def rec(node: ET.Element) -> None:
        if node.text and node.text.strip():
            parts.append(node.text)
        for ch in list(node):
            rec(ch)
            if ch.tail and ch.tail.strip():
                parts.append(ch.tail)

    rec(el)
    return _strip(" ".join(parts))


@dataclass(frozen=True)
class RoleInfo:
    file: str
    name: str
    origin: str
    description: str


def parse_svg(path: Path) -> RoleInfo:
    tree = ET.parse(path)
    root = tree.getroot()

    def find_text_by_id(id_value: str) -> ET.Element | None:
        # Try both namespaced and non-namespaced tags.
        for el in root.iter():
            if el.tag.endswith("text") and el.attrib.get("id") == id_value:
                return el
        return None

    name_el = find_text_by_id("role")
    origin_el = find_text_by_id("origine")
    desc_el = find_text_by_id("descText")

    # Fallback for older/inkscape-edited files: pick the first two header texts (y≈50 and y≈70) that aren't descText
    if name_el is None or origin_el is None:
        header_candidates: list[ET.Element] = []
        for el in root.iter():
            if not el.tag.endswith("text"):
                continue
            if el.attrib.get("id") == "descText":
                continue
            y = el.attrib.get("y")
            if y in {"50", "70"} and el.attrib.get("text-anchor") == "middle":
                header_candidates.append(el)
        # sort by y
        header_candidates.sort(key=lambda e: int(e.attrib.get("y", "9999")))
        if name_el is None and header_candidates:
            name_el = header_candidates[0]
        if origin_el is None and len(header_candidates) > 1:
            origin_el = header_candidates[1]

    if name_el is None or origin_el is None or desc_el is None:
        missing = [
            k
            for k, v in [
                ("role", name_el),
                ("origine", origin_el),
                ("descText", desc_el),
            ]
            if v is None
        ]
        raise ValueError(f"{path.name}: missing ids {missing}")

    name = _text_content(name_el)
    origin = _text_content(origin_el)
    description = _text_content(desc_el)

    return RoleInfo(file=path.name, name=name, origin=origin, description=description)


def iter_roles(role_dir: Path) -> Iterable[RoleInfo]:
    for p in sorted(role_dir.glob("*.svg")):
        yield parse_svg(p)


def main(argv: list[str]) -> int:
    repo_root = Path(__file__).resolve().parents[1]
    role_dir = repo_root / "roles"
    data = [r.__dict__ for r in iter_roles(role_dir)]
    json.dump(data, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
