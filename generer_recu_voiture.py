#!/usr/bin/env python3
"""
Générateur de Reçu et Attestation de Vente de Véhicule Automobile (A4 - 1 page)
Adapté aux ventes entre particuliers au Mali / Zone FCFA (XOF).
"""

import argparse
import json
import os
from typing import Dict, Any, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


# ---------------------------------------------------------------------------
# Conversion d'un entier positif en toutes lettres (français standard)
# ---------------------------------------------------------------------------

_UNITES = [
    "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
    "dix-sept", "dix-huit", "dix-neuf",
]

_DIZAINES = [
    "", "", "vingt", "trente", "quarante", "cinquante", "soixante",
    "soixante", "quatre-vingt", "quatre-vingt",
]


def _sous_mille(n: int, accord_pluriel: bool = True) -> str:
    assert 0 <= n < 1000
    if n == 0:
        return ""
    parts = []
    c, r = divmod(n, 100)
    if c > 0:
        if c == 1:
            parts.append("cent")
        else:
            parts.append(f"{_UNITES[c]} cent" + ("s" if r == 0 and accord_pluriel else ""))
    if r > 0:
        if r < 20:
            parts.append(_UNITES[r])
        else:
            d, u = divmod(r, 10)
            if d in (7, 9):
                u += 10
            diz = _DIZAINES[d]
            if d == 8 and u == 0:
                parts.append(diz + ("s" if accord_pluriel else ""))
            elif u == 0:
                parts.append(diz)
            elif u in (1, 11) and d in (2, 3, 4, 5, 6, 7):
                parts.append(f"{diz} et {_UNITES[u]}")
            else:
                parts.append(f"{diz}-{_UNITES[u]}")
    return " ".join(parts)


def nombre_en_lettres(n: int) -> str:
    if n == 0:
        return "zéro"
    if n < 0:
        return "moins " + nombre_en_lettres(-n)

    milliards, reste = divmod(n, 1_000_000_000)
    millions, reste = divmod(reste, 1_000_000)
    milliers, unites = divmod(reste, 1_000)

    blocs = []
    if milliards:
        blocs.append(f"{_sous_mille(milliards)} milliard" + ("s" if milliards > 1 else ""))
    if millions:
        blocs.append(f"{_sous_mille(millions)} million" + ("s" if millions > 1 else ""))
    if milliers:
        if milliers == 1:
            blocs.append("mille")
        else:
            blocs.append(f"{_sous_mille(milliers, accord_pluriel=False)} mille")
    if unites:
        blocs.append(_sous_mille(unites, accord_pluriel=True))

    texte = " ".join(blocs)
    return texte[:1].upper() + texte[1:]


def formater_fcfa(montant_raw: Any) -> str:
    if montant_raw is None or str(montant_raw).strip() == "":
        return ""
    digits = "".join(ch for ch in str(montant_raw) if ch.isdigit())
    if not digits:
        return str(montant_raw).strip()
    val = int(digits)
    return f"{val:,}".replace(",", " ") + " FCFA"


# ---------------------------------------------------------------------------
# Polices TrueType (accents français nets)
# ---------------------------------------------------------------------------

def enregistrer_polices() -> Dict[str, str]:
    dejavu_reg = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    dejavu_bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    dejavu_mono = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
    vera_it = "/home/user/.local/lib/python3.11/site-packages/reportlab/fonts/VeraIt.ttf"

    if os.path.exists(dejavu_reg) and os.path.exists(dejavu_bold):
        pdfmetrics.registerFont(TTFont("DocSans", dejavu_reg))
        pdfmetrics.registerFont(TTFont("DocSans-Bold", dejavu_bold))
        if os.path.exists(vera_it):
            pdfmetrics.registerFont(TTFont("DocSans-Italic", vera_it))
        else:
            pdfmetrics.registerFont(TTFont("DocSans-Italic", dejavu_reg))
        if os.path.exists(dejavu_mono):
            pdfmetrics.registerFont(TTFont("DocMono-Bold", dejavu_mono))
        else:
            pdfmetrics.registerFont(TTFont("DocMono-Bold", dejavu_bold))
        return {
            "regular": "DocSans",
            "bold": "DocSans-Bold",
            "italic": "DocSans-Italic",
            "mono": "DocMono-Bold",
        }
    return {
        "regular": "Helvetica",
        "bold": "Helvetica-Bold",
        "italic": "Helvetica-Oblique",
        "mono": "Courier-Bold",
    }


# ---------------------------------------------------------------------------
# Palette graphique institutionnelle
# ---------------------------------------------------------------------------

NAVY = colors.HexColor("#16325C")
NAVY_DARK = colors.HexColor("#0F2342")
ACCENT_GOLD = colors.HexColor("#B7791F")
SLATE_TEXT = colors.HexColor("#1E293B")
MUTED_TEXT = colors.HexColor("#475569")
LIGHT_TEXT = colors.HexColor("#64748B")
BG_SOFT = colors.HexColor("#F8FAFC")
BG_HIGHLIGHT = colors.HexColor("#EFF6FF")
BORDER_STRONG = colors.HexColor("#94A3B8")
BORDER_LIGHT = colors.HexColor("#CBD5E1")
FIELD_BG = colors.HexColor("#F1F5F9")


# ---------------------------------------------------------------------------
# Utilitaires de dessin
# ---------------------------------------------------------------------------

def draw_section_card(
    c: canvas.Canvas,
    x: float,
    y_top: float,
    w: float,
    h: float,
    title: str,
    fonts: Dict[str, str],
    header_h: float = 6.2 * mm,
) -> float:
    """Dessine un encadré de section avec bandeau de titre et retourne y_top du corps."""
    y_bottom = y_top - h
    c.setFillColor(colors.white)
    c.setStrokeColor(BORDER_STRONG)
    c.setLineWidth(0.75)
    c.roundRect(x, y_bottom, w, h, radius=1.8 * mm, stroke=1, fill=1)

    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y_bottom, w, h, radius=1.8 * mm)
    c.clipPath(p, stroke=0, fill=0)
    c.setFillColor(NAVY)
    c.rect(x, y_top - header_h, w, header_h, stroke=0, fill=1)
    c.setStrokeColor(ACCENT_GOLD)
    c.setLineWidth(0.9)
    c.line(x, y_top - header_h, x + w, y_top - header_h)
    c.restoreState()

    c.setFillColor(colors.white)
    c.setFont(fonts["bold"], 8.3)
    c.drawString(x + 3.2 * mm, y_top - header_h + 1.9 * mm, title)
    return y_top - header_h


def draw_field_line(
    c: canvas.Canvas,
    name: str,
    label: str,
    value: Optional[str],
    x: float,
    y_baseline: float,
    total_w: float,
    fonts: Dict[str, str],
    fillable: bool = False,
    mono_value: bool = False,
    bold_value: bool = False,
    font_size: float = 8.0,
    placeholder: str = "",
    suffix: str = "",
):
    """Dessine 'Libellé : ______ [suffix]' avec valeur pré-remplie OU champ AcroForm + pointillés."""
    c.setFillColor(MUTED_TEXT)
    c.setFont(fonts["regular"], font_size)
    if label:
        c.drawString(x, y_baseline, label)
        lw = pdfmetrics.stringWidth(label, fonts["regular"], font_size) + 1.8 * mm
    else:
        lw = 0.0

    has_val = bool(value and str(value).strip())
    suffix_w = 0.0
    if suffix and not has_val:
        suffix_w = pdfmetrics.stringWidth(suffix, fonts["bold"], font_size - 0.3) + 1.8 * mm

    val_x = x + lw
    val_w = max(8 * mm, (x + total_w) - val_x - suffix_w)

    c.saveState()
    c.setStrokeColor(BORDER_LIGHT if has_val else BORDER_STRONG)
    c.setLineWidth(0.55)
    if not has_val:
        c.setDash(1.2, 1.4)
    c.line(val_x, y_baseline - 1.1 * mm, val_x + val_w, y_baseline - 1.1 * mm)
    c.restoreState()

    if suffix and not has_val:
        c.setFillColor(NAVY)
        c.setFont(fonts["bold"], font_size - 0.3)
        c.drawRightString(x + total_w, y_baseline, suffix)

    if has_val:
        c.setFillColor(NAVY_DARK if bold_value else SLATE_TEXT)
        chosen_font = fonts["mono"] if mono_value else fonts["bold"]
        fsize = font_size + (0.25 if bold_value else 0.0)
        txt = str(value).strip()
        while fsize > 6.2 and pdfmetrics.stringWidth(txt, chosen_font, fsize) > val_w - 1 * mm:
            fsize -= 0.25
        c.setFont(chosen_font, fsize)
        c.drawString(val_x + 0.6 * mm, y_baseline + 0.15 * mm, txt)
    elif fillable:
        c.acroForm.textfield(
            name=name,
            tooltip=(label.rstrip(" :") or name),
            value=placeholder,
            x=val_x,
            y=y_baseline - 1.2 * mm,
            width=val_w,
            height=4.5 * mm,
            borderWidth=0,
            fillColor=FIELD_BG,
            textColor=SLATE_TEXT,
            fontName="Helvetica",
            fontSize=8.5,
            fieldFlags="",
        )


def draw_checkbox_item(
    c: canvas.Canvas,
    name: str,
    label: str,
    checked: bool,
    x: float,
    y_baseline: float,
    fonts: Dict[str, str],
    fillable: bool = False,
    font_size: float = 7.7,
) -> float:
    """Dessine une case à cocher propre et retourne la coordonnée X de fin."""
    box_size = 3.4 * mm
    box_y = y_baseline - 0.6 * mm

    c.setStrokeColor(NAVY if checked else BORDER_STRONG)
    c.setFillColor(NAVY if checked else colors.white)
    c.setLineWidth(0.75)
    c.rect(x, box_y, box_size, box_size, stroke=1, fill=1)

    if checked:
        c.saveState()
        c.setStrokeColor(colors.white)
        c.setLineWidth(1.15)
        c.setLineCap(1)
        c.setLineJoin(1)
        p = c.beginPath()
        p.moveTo(x + 0.65 * mm, box_y + 1.75 * mm)
        p.lineTo(x + 1.45 * mm, box_y + 0.8 * mm)
        p.lineTo(x + 2.8 * mm, box_y + 2.65 * mm)
        c.drawPath(p, stroke=1, fill=0)
        c.restoreState()
    elif fillable:
        c.acroForm.checkbox(
            name=name,
            tooltip=label,
            checked=False,
            x=x,
            y=box_y,
            size=box_size,
            borderWidth=0.7,
            borderColor=BORDER_STRONG,
            fillColor=colors.white,
            textColor=NAVY,
            buttonStyle="check",
        )

    c.setFillColor(SLATE_TEXT if checked else MUTED_TEXT)
    c.setFont(fonts["bold"] if checked else fonts["regular"], font_size)
    txt_x = x + box_size + 1.4 * mm
    c.drawString(txt_x, y_baseline, label)
    return txt_x + pdfmetrics.stringWidth(label, fonts["bold"] if checked else fonts["regular"], font_size)


def wrap_paragraph(text: str, font_name: str, font_size: float, max_w: float):
    words = text.split()
    lines = []
    cur = []
    for w in words:
        cand = " ".join(cur + [w])
        if pdfmetrics.stringWidth(cand, font_name, font_size) <= max_w:
            cur.append(w)
        else:
            if cur:
                lines.append(" ".join(cur))
            cur = [w]
    if cur:
        lines.append(" ".join(cur))
    return lines


# ---------------------------------------------------------------------------
# Génération complète du document A4 (1 page)
# ---------------------------------------------------------------------------

def generer_recu_pdf(output_path: str, data: Dict[str, Any], fillable: bool = False) -> str:
    fonts = enregistrer_polices()
    c = canvas.Canvas(output_path, pagesize=A4)
    c.setTitle("Reçu et Attestation de Vente de Véhicule Automobile")
    c.setAuthor("Générateur Reçu Auto - Mali / Zone FCFA")
    c.setSubject("Acte et reçu de cession de véhicule d'occasion entre particuliers")

    margin_x = 12.5 * mm
    usable_w = 210 * mm - 2 * margin_x  # 185 mm
    gutter = 4.0 * mm
    col_w = (usable_w - gutter) / 2.0  # 90.5 mm

    # =========================================================================
    # 1. EN-TÊTE INSTITUTIONNEL (y = 286.5 -> 266.0 mm, h = 20.5 mm)
    # =========================================================================
    hdr_top = 286.5 * mm
    hdr_h = 20.5 * mm
    hdr_bot = hdr_top - hdr_h

    c.setFillColor(NAVY_DARK)
    c.roundRect(margin_x, hdr_bot, usable_w, hdr_h, radius=2.2 * mm, stroke=0, fill=1)

    c.setFillColor(ACCENT_GOLD)
    c.roundRect(margin_x + 3.0 * mm, hdr_bot + 3.0 * mm, 1.5 * mm, hdr_h - 6.0 * mm, radius=0.6 * mm, stroke=0, fill=1)

    c.setFillColor(colors.white)
    c.setFont(fonts["bold"], 11.4)
    c.drawString(margin_x + 7.2 * mm, hdr_top - 7.8 * mm, "REÇU ET ATTESTATION DE VENTE DE VÉHICULE")

    c.setFillColor(colors.HexColor("#DBEAFE"))
    c.setFont(fonts["regular"], 7.7)
    c.drawString(
        margin_x + 7.2 * mm,
        hdr_top - 12.8 * mm,
        "Cession de véhicule automobile entre particuliers — Acte valant reçu de paiement",
    )
    c.setFillColor(colors.HexColor("#93C5FD"))
    c.setFont(fonts["italic"], 7.1)
    c.drawString(
        margin_x + 7.2 * mm,
        hdr_top - 17.0 * mm,
        "Établi en deux (02) exemplaires originaux — République du Mali / Zone UEMOA (FCFA)",
    )

    meta_w = 53.5 * mm
    meta_x = margin_x + usable_w - meta_w - 2.6 * mm
    meta_y = hdr_bot + 2.3 * mm
    meta_h = hdr_h - 4.6 * mm
    c.setFillColor(colors.white)
    c.roundRect(meta_x, meta_y, meta_w, meta_h, radius=1.5 * mm, stroke=0, fill=1)

    draw_field_line(
        c, "ref_recu", "Réf. N° :", data.get("numero_recu"),
        meta_x + 2.4 * mm, meta_y + 11.2 * mm, meta_w - 4.8 * mm,
        fonts, fillable=fillable, bold_value=True, font_size=7.4,
    )
    draw_field_line(
        c, "date_vente_top", "Date :", data.get("date_vente"),
        meta_x + 2.4 * mm, meta_y + 6.4 * mm, meta_w - 4.8 * mm,
        fonts, fillable=fillable, bold_value=True, font_size=7.4,
    )
    draw_field_line(
        c, "heure_remise", "Heure remise :", data.get("heure_vente"),
        meta_x + 2.4 * mm, meta_y + 1.8 * mm, meta_w - 4.8 * mm,
        fonts, fillable=fillable, bold_value=True, font_size=7.4,
    )

    # =========================================================================
    # 2. VENDEUR & ACHETEUR CÔTE À CÔTE (y = 262.8 -> 217.8 mm, h = 45.0 mm)
    # =========================================================================
    parties_top = 262.8 * mm
    parties_h = 45.0 * mm

    vendeur = data.get("vendeur", {}) or {}
    acheteur = data.get("acheteur", {}) or {}

    titre_vendeur = vendeur.get("titre_section", "1. LE VENDEUR (CÉDANT)")
    titre_acheteur = acheteur.get("titre_section", "2. L'ACHETEUR (ACQUÉREUR)")

    for titre, partie, prefix, col_x in [
        (titre_vendeur, vendeur, "vendeur", margin_x),
        (titre_acheteur, acheteur, "acheteur", margin_x + col_w + gutter),
    ]:
        body_top = draw_section_card(c, col_x, parties_top, col_w, parties_h, titre, fonts)
        px = col_x + 3.0 * mm
        pw = col_w - 6.0 * mm

        if partie.get("nina") or partie.get("naissance"):
            rows = [
                (f"{prefix}_nom", "Nom & Prénom(s) :", partie.get("nom"), True, False),
                (f"{prefix}_naiss", "Né(e) le / Lieu :", partie.get("naissance"), False, False),
                (f"{prefix}_piece", "Carte CEDEAO N° :", partie.get("piece_identite"), True, False),
                (f"{prefix}_nina", "Numéro NINA :", partie.get("nina"), True, True),
                (f"{prefix}_tel", "Tél. / Domicile :", partie.get("telephone") or partie.get("adresse"), False, False),
            ]
        else:
            rows = [
                (f"{prefix}_nom", "Nom & Prénom(s) :", partie.get("nom"), True, False),
                (f"{prefix}_piece", "Pièce d'identité / N° :", partie.get("piece_identite"), False, False),
                (f"{prefix}_delivree", "Délivrée le / par :", partie.get("piece_delivree"), False, False),
                (f"{prefix}_tel", "Téléphone :", partie.get("telephone"), True, False),
                (f"{prefix}_adresse", "Domicile / Quartier :", partie.get("adresse"), False, False),
            ]

        for r_i, (fname, flabel, fval, is_bold, is_mono) in enumerate(rows):
            ry = body_top - (5.8 + r_i * 7.3) * mm
            draw_field_line(
                c, fname, flabel, fval, px, ry, pw,
                fonts, fillable=fillable, bold_value=is_bold, mono_value=is_mono, font_size=7.7,
            )

    # =========================================================================
    # 3. DÉSIGNATION DU VÉHICULE (y = 214.5 -> 171.5 mm, h = 43.0 mm)
    # =========================================================================
    veh_top = 214.5 * mm
    veh_h = 43.0 * mm
    veh_body_top = draw_section_card(
        c, margin_x, veh_top, usable_w, veh_h,
        "3. DÉSIGNATION ET CARACTÉRISTIQUES DU VÉHICULE VENDU (SELON CARTE GRISE)", fonts,
    )
    veh = data.get("vehicule", {}) or {}

    mid_x = margin_x + usable_w / 2.0
    c.saveState()
    c.setStrokeColor(BORDER_LIGHT)
    c.setLineWidth(0.6)
    c.line(mid_x, veh_top - veh_h + 2.5 * mm, mid_x, veh_body_top - 2.0 * mm)
    c.restoreState()

    veh_left_x = margin_x + 3.2 * mm
    veh_right_x = mid_x + 3.2 * mm
    veh_col_w = usable_w / 2.0 - 6.4 * mm

    row4_left_lbl = veh.get("row4_left_label", "Kilométrage affiché :")
    row4_left_val = veh.get("row4_left_value", veh.get("kilometrage"))
    row4_right_lbl = veh.get("row4_right_label", "N° Carte Grise :")
    row4_right_val = veh.get("row4_right_value", veh.get("carte_grise_num"))

    veh_rows = [
        (
            ("veh_marque", "Marque & Modèle :", veh.get("marque_modele"), True, False),
            ("veh_genre", "Genre & Carrosserie :", veh.get("carrosserie"), False, False),
        ),
        (
            ("veh_immat", "N° d'Immatriculation :", veh.get("immatriculation"), True, True),
            ("veh_annee", "1ère mise en circ. :", veh.get("annee"), True, False),
        ),
        (
            ("veh_chassis", "N° de Châssis (VIN) :", veh.get("chassis"), True, True),
            ("veh_energie", veh.get("energie_label", "Énergie & Couleur :"), veh.get("energie_couleur"), False, False),
        ),
        (
            ("veh_r4l", row4_left_lbl, row4_left_val, False, False),
            ("veh_r4r", row4_right_lbl, row4_right_val, False, False),
        ),
    ]
    for r_i, (left_spec, right_spec) in enumerate(veh_rows):
        ry = veh_body_top - (6.0 + r_i * 8.4) * mm
        draw_field_line(
            c, left_spec[0], left_spec[1], left_spec[2],
            veh_left_x, ry, veh_col_w, fonts,
            fillable=fillable, bold_value=left_spec[3], mono_value=left_spec[4], font_size=7.8,
        )
        draw_field_line(
            c, right_spec[0], right_spec[1], right_spec[2],
            veh_right_x, ry, veh_col_w, fonts,
            fillable=fillable, bold_value=right_spec[3], mono_value=right_spec[4], font_size=7.8,
        )

    # =========================================================================
    # 4. PRIX, RÈGLEMENT ET DOCUMENTS REMIS (y = 168.2 -> 114.7 mm, h = 53.5 mm)
    # =========================================================================
    pay_top = 168.2 * mm
    pay_h = 53.5 * mm
    pay_body_top = draw_section_card(
        c, margin_x, pay_top, usable_w, pay_h,
        "4. PRIX DE VENTE, MODALITÉS DE RÈGLEMENT ET PIÈCES REMISES", fonts,
    )
    paiement = data.get("paiement", {}) or {}

    prix_raw = paiement.get("prix_vente")
    prix_chiffres = formater_fcfa(prix_raw)
    prix_lettres = paiement.get("prix_lettres") or ""
    if not prix_lettres and prix_raw is not None and str(prix_raw).strip() != "":
        digits = "".join(ch for ch in str(prix_raw) if ch.isdigit())
        if digits:
            prix_lettres = f"{nombre_en_lettres(int(digits))} Francs CFA"

    montant_verse_raw = paiement.get("montant_verse")
    montant_verse_str = formater_fcfa(montant_verse_raw)

    box_margin = 2.8 * mm
    pbox_x = margin_x + box_margin
    pbox_w = usable_w - 2 * box_margin
    pbox_h = 16.2 * mm
    pbox_top = pay_body_top - 2.2 * mm
    pbox_bot = pbox_top - pbox_h

    c.setFillColor(BG_HIGHLIGHT)
    c.setStrokeColor(NAVY)
    c.setLineWidth(0.7)
    c.roundRect(pbox_x, pbox_bot, pbox_w, pbox_h, radius=1.5 * mm, stroke=1, fill=1)

    half_pw = (pbox_w - 8.0 * mm) / 2.0
    draw_field_line(
        c, "prix_chiffres", "PRIX DE VENTE CONVENU :", prix_chiffres,
        pbox_x + 2.8 * mm, pbox_top - 5.8 * mm, half_pw + 2.5 * mm,
        fonts, fillable=fillable, bold_value=True, font_size=8.0,
        suffix="FCFA",
    )

    draw_field_line(
        c, "montant_verse", "Montant reçu ce jour :", montant_verse_str,
        pbox_x + half_pw + 8.5 * mm, pbox_top - 5.8 * mm, half_pw - 5.3 * mm,
        fonts, fillable=fillable, bold_value=True, font_size=8.0,
        suffix="FCFA",
    )

    draw_field_line(
        c, "prix_lettres", "Arrêté en toutes lettres à :", prix_lettres,
        pbox_x + 2.8 * mm, pbox_top - 13.0 * mm, pbox_w - 5.6 * mm,
        fonts, fillable=fillable, bold_value=True, font_size=7.9,
        suffix="Francs CFA",
    )

    mode = (paiement.get("mode") or "").lower()
    row1_y = pbox_bot - 5.6 * mm
    lbl_mode = "Mode de paiement :"
    c.setFillColor(MUTED_TEXT)
    c.setFont(fonts["bold"], 7.6)
    c.drawString(pbox_x, row1_y, lbl_mode)

    cur_x = pbox_x + pdfmetrics.stringWidth(lbl_mode, fonts["bold"], 7.6) + 2.6 * mm
    for cb_id, cb_label, match_keys in [
        ("mode_especes", "Espèces", ["especes", "espèces", "cash"]),
        ("mode_mobile", "Mobile Money (Orange/Moov/Wave)", ["mobile", "orange", "moov", "wave"]),
        ("mode_virement", "Virement", ["virement", "banque"]),
        ("mode_cheque", "Chèque", ["cheque", "chèque"]),
    ]:
        is_chk = any(k in mode for k in match_keys)
        cur_x = draw_checkbox_item(c, cb_id, cb_label, is_chk, cur_x, row1_y, fonts, fillable=fillable, font_size=7.4) + 3.4 * mm

    row2_y = row1_y - 6.8 * mm
    statut = (paiement.get("statut") or "").lower()
    reste_str = formater_fcfa(paiement.get("reste_a_payer"))
    lbl_statut = "Situation du règlement :"
    c.setFillColor(MUTED_TEXT)
    c.setFont(fonts["bold"], 7.6)
    c.drawString(pbox_x, row2_y, lbl_statut)

    cx2 = pbox_x + pdfmetrics.stringWidth(lbl_statut, fonts["bold"], 7.6) + 2.6 * mm
    cx2 = draw_checkbox_item(
        c, "statut_solde", "Payé intégralement (Reste dû : 0 FCFA)",
        statut in ("solde", "soldé", "integral", "intégral", "complet"),
        cx2, row2_y, fonts, fillable=fillable, font_size=7.4,
    ) + 3.8 * mm
    cx2 = draw_checkbox_item(
        c, "statut_acompte", "Acompte — Reste dû :",
        statut in ("acompte", "partiel"),
        cx2, row2_y, fonts, fillable=fillable, font_size=7.4,
    ) + 1.5 * mm
    draw_field_line(
        c, "reste_a_payer", "", reste_str,
        cx2, row2_y, (margin_x + usable_w - box_margin) - cx2,
        fonts, fillable=fillable, bold_value=True, font_size=7.5,
        suffix="FCFA",
    )

    sep_y = row2_y - 3.0 * mm
    c.setStrokeColor(BORDER_LIGHT)
    c.setLineWidth(0.5)
    c.line(pbox_x, sep_y, pbox_x + pbox_w, sep_y)

    docs_remis = [d.lower() for d in (data.get("documents_remis") or [])]
    row3_y = sep_y - 5.3 * mm
    lbl_docs = "Remis à l'acheteur :"
    c.setFillColor(MUTED_TEXT)
    c.setFont(fonts["bold"], 7.5)
    c.drawString(pbox_x, row3_y, lbl_docs)

    cx3 = pbox_x + pdfmetrics.stringWidth(lbl_docs, fonts["bold"], 7.5) + 2.4 * mm
    for doc_id, doc_label, key in [
        ("doc_cg", "Carte grise", "carte grise"),
        ("doc_vt", "Visite technique", "visite"),
        ("doc_vignette", "Vignette", "vignette"),
        ("doc_assur", "Assurance", "assurance"),
        ("doc_douane", "Dédouanement", "douane"),
    ]:
        checked_doc = any(key in d for d in docs_remis)
        cx3 = draw_checkbox_item(c, doc_id, doc_label, checked_doc, cx3, row3_y, fonts, fillable=fillable, font_size=7.2) + 2.6 * mm

    draw_field_line(
        c, "nb_cles", "Clés :", data.get("nombre_cles"),
        cx3 + 0.4 * mm, row3_y, (pbox_x + pbox_w) - (cx3 + 0.4 * mm),
        fonts, fillable=fillable, bold_value=True, font_size=7.3,
    )

    # =========================================================================
    # 5. DÉCLARATIONS ET ENGAGEMENTS (y = 111.4 -> 84.4 mm, h = 27.0 mm)
    # =========================================================================
    eng_top = 111.4 * mm
    eng_h = 27.0 * mm
    eng_bot = eng_top - eng_h

    c.setFillColor(BG_SOFT)
    c.setStrokeColor(BORDER_STRONG)
    c.setLineWidth(0.65)
    c.roundRect(margin_x, eng_bot, usable_w, eng_h, radius=1.6 * mm, stroke=1, fill=1)

    c.setFillColor(NAVY)
    c.setFont(fonts["bold"], 7.9)
    c.drawString(margin_x + 3.2 * mm, eng_top - 4.7 * mm, "5. DÉCLARATIONS ET ENGAGEMENTS DES PARTIES")

    clauses = [
        (
            "• Quittance et garantie de propriété : La partie venderesse reconnaît avoir reçu de l'Acheteur la somme convenue ci-dessus "
            "(dont le présent acte vaut reçu et quittance) et certifie sur l'honneur céder légitimement le véhicule en toute propriété, "
            "libre de tout gage, saisie, opposition ou litige."
        ),
        (
            "• État du véhicule et transfert de responsabilité : L'Acheteur déclare avoir examiné et essayé le véhicule, l'accepter "
            "en l'état où il se trouve, et assumer l'entière responsabilité civile, pénale et administrative du véhicule à compter "
            "de la date et de l'heure de sa remise effective."
        ),
    ]
    cur_text_y = eng_top - 9.0 * mm
    c.setFillColor(SLATE_TEXT)
    c.setFont(fonts["regular"], 7.15)
    for clause in clauses:
        for line in wrap_paragraph(clause, fonts["regular"], 7.15, usable_w - 6.4 * mm):
            c.drawString(margin_x + 3.2 * mm, cur_text_y, line)
            cur_text_y -= 3.55 * mm
        cur_text_y -= 0.7 * mm

    # =========================================================================
    # 6. LIEU, DATE, SIGNATURES ET TÉMOINS
    # =========================================================================
    lieu_y = 77.6 * mm
    lieu_default = "Bamako" if ("lieu_vente" not in data and not fillable) else data.get("lieu_vente", "")
    draw_field_line(
        c, "lieu_signature", "Fait à :", lieu_default,
        margin_x + 1.0 * mm, lieu_y, 50.0 * mm,
        fonts, fillable=fillable, bold_value=True, font_size=8.0,
    )
    draw_field_line(
        c, "date_signature", "Le :", data.get("date_vente"),
        margin_x + 54.0 * mm, lieu_y, 39.0 * mm,
        fonts, fillable=fillable, bold_value=True, font_size=8.0,
    )
    c.setFillColor(MUTED_TEXT)
    c.setFont(fonts["italic"], 7.3)
    c.drawRightString(
        margin_x + usable_w, lieu_y + 0.2 * mm,
        "En deux (02) exemplaires originaux remis à chacune des parties",
    )

    # --- Encadrés Signatures Principales (y = 74.2 -> 39.2 mm, h = 35.0 mm) ---
    sig_top = 74.2 * mm
    sig_h = 35.0 * mm
    sig_bot = sig_top - sig_h

    sig_v_title = vendeur.get("titre_signature", "SIGNATURE DU VENDEUR (Cédant)")
    sig_v_sub = vendeur.get("sous_signature", "Précédée de la mention « Lu et approuvé, bon pour vente »")
    sig_a_title = acheteur.get("titre_signature", "SIGNATURE DE L'ACHETEUR (Acquéreur)")
    sig_a_sub = acheteur.get("sous_signature", "Précédée de la mention « Lu et approuvé, véhicule reçu »")

    for title, subtitle, sx in [
        (sig_v_title, sig_v_sub, margin_x),
        (sig_a_title, sig_a_sub, margin_x + col_w + gutter),
    ]:
        c.setFillColor(colors.white)
        c.setStrokeColor(NAVY)
        c.setLineWidth(0.75)
        c.roundRect(sx, sig_bot, col_w, sig_h, radius=1.8 * mm, stroke=1, fill=1)

        c.saveState()
        p = c.beginPath()
        p.roundRect(sx, sig_bot, col_w, sig_h, radius=1.8 * mm)
        c.clipPath(p, stroke=0, fill=0)
        c.setFillColor(BG_HIGHLIGHT)
        c.rect(sx, sig_top - 6.0 * mm, col_w, 6.0 * mm, stroke=0, fill=1)
        c.setStrokeColor(BORDER_LIGHT)
        c.setLineWidth(0.6)
        c.line(sx, sig_top - 6.0 * mm, sx + col_w, sig_top - 6.0 * mm)
        c.restoreState()

        c.setFillColor(NAVY)
        t_size = 7.9
        while t_size > 6.5 and pdfmetrics.stringWidth(title, fonts["bold"], t_size) > col_w - 6.0 * mm:
            t_size -= 0.25
        c.setFont(fonts["bold"], t_size)
        c.drawCentredString(sx + col_w / 2.0, sig_top - 4.3 * mm, title)

        c.setFillColor(SLATE_TEXT)
        c.setFont(fonts["italic"], 6.8)
        c.drawCentredString(sx + col_w / 2.0, sig_top - 9.5 * mm, subtitle)

        c.setFillColor(colors.HexColor("#94A3B8"))
        c.setFont(fonts["regular"], 6.5)
        c.drawCentredString(
            sx + col_w / 2.0, sig_bot + 2.1 * mm,
            "Signature / Empreinte — Espace visa légalisation (Mairie / Commissariat)",
        )

    # --- Encadrés Témoins (y = 36.4 -> 13.0 mm, h = 23.4 mm) ---
    tem_top = 36.4 * mm
    tem_h = 23.4 * mm
    tem_bot = tem_top - tem_h
    temoins = data.get("temoins", [{}, {}])
    while len(temoins) < 2:
        temoins.append({})

    t1_title = (temoins[0] or {}).get("titre", "TÉMOIN N° 1 (Côté Vendeur)")
    t2_title = (temoins[1] or {}).get("titre", "TÉMOIN N° 2 (Côté Acheteur)")

    for idx, (ttitle, tdata, tx) in enumerate([
        (t1_title, temoins[0] or {}, margin_x),
        (t2_title, temoins[1] or {}, margin_x + col_w + gutter),
    ]):
        c.setFillColor(BG_SOFT)
        c.setStrokeColor(BORDER_STRONG)
        c.setLineWidth(0.65)
        c.roundRect(tx, tem_bot, col_w, tem_h, radius=1.5 * mm, stroke=1, fill=1)

        c.setFillColor(NAVY)
        c.setFont(fonts["bold"], 7.3)
        c.drawString(tx + 2.6 * mm, tem_top - 4.3 * mm, ttitle)

        info_w = col_w * 0.65
        draw_field_line(
            c, f"temoin_{idx+1}_nom", "Nom :", tdata.get("nom"),
            tx + 2.6 * mm, tem_top - 9.4 * mm, info_w,
            fonts, fillable=fillable, bold_value=True, font_size=7.2,
        )
        draw_field_line(
            c, f"temoin_{idx+1}_piece", "Pièce/NINA :", tdata.get("piece"),
            tx + 2.6 * mm, tem_top - 14.5 * mm, info_w,
            fonts, fillable=fillable, bold_value=False, mono_value=bool(tdata.get("piece")), font_size=7.0,
        )
        draw_field_line(
            c, f"temoin_{idx+1}_tel", "Tél. :", tdata.get("telephone"),
            tx + 2.6 * mm, tem_top - 19.6 * mm, info_w,
            fonts, fillable=fillable, bold_value=False, font_size=7.1,
        )

        sig_tx = tx + col_w * 0.70
        sig_tw = col_w * 0.275
        c.setStrokeColor(BORDER_LIGHT)
        c.setFillColor(colors.white)
        c.setLineWidth(0.5)
        c.roundRect(sig_tx, tem_bot + 2.0 * mm, sig_tw, tem_h - 7.0 * mm, radius=1.0 * mm, stroke=1, fill=1)
        c.setFillColor(LIGHT_TEXT)
        c.setFont(fonts["italic"], 6.4)
        c.drawCentredString(sig_tx + sig_tw / 2.0, tem_top - 8.8 * mm, "Signature")

    c.setFillColor(LIGHT_TEXT)
    c.setFont(fonts["regular"], 6.7)
    c.drawCentredString(
        105 * mm,
        8.6 * mm,
        "Document original à conserver par chaque partie — Il est recommandé de faire légaliser les signatures auprès des autorités compétentes.",
    )

    c.showPage()
    c.save()
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Générateur de Reçu de Vente de Voiture PDF (A4)")
    parser.add_argument("-o", "--output", default="Recu_Vente_Voiture.pdf", help="Chemin du PDF généré")
    parser.add_argument("-d", "--data", default=None, help="Fichier JSON contenant les informations à pré-remplir")
    parser.add_argument("--fillable", action="store_true", help="Activer les champs PDF interactifs remplissables")
    args = parser.parse_args()

    data = {}
    if args.data:
        with open(args.data, "r", encoding="utf-8") as f:
            data = json.load(f)

    out = generer_recu_pdf(args.output, data=data, fillable=args.fillable)
    print(f"PDF généré avec succès : {out}")


if __name__ == "__main__":
    main()
