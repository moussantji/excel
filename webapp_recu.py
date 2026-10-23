#!/usr/bin/env python3
"""
Serveur Web léger (0.0.0.0:8000) pour remplir, prévisualiser et télécharger
en un clic le Reçu de Vente de Véhicule Automobile en PDF (A4 - 1 page).
"""

import io
import json
import os
import tempfile
import urllib.parse
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

import pymupdf
from generer_recu_voiture import generer_recu_pdf, nombre_en_lettres

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BLANK_PDF_PATH = os.path.join(BASE_DIR, "Recu_Vente_Voiture_Mali.pdf")


HTML_PAGE = """<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reçu de Vente de Voiture — Téléchargement PDF</title>
  <style>
    :root {
      --navy: #16325C;
      --navy-dark: #0F2342;
      --gold: #B7791F;
      --green: #15803D;
      --green-hover: #166534;
      --bg: #F1F5F9;
      --card: #FFFFFF;
      --border: #CBD5E1;
      --text: #1E293B;
      --muted: #475569;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
      padding: 16px;
    }
    .container {
      max-width: 920px;
      margin: 0 auto;
    }
    .hero {
      background: linear-gradient(135deg, var(--navy-dark), var(--navy));
      color: #fff;
      border-radius: 14px;
      padding: 20px 22px;
      margin-bottom: 18px;
      box-shadow: 0 6px 20px rgba(15, 35, 66, 0.14);
      border-left: 5px solid var(--gold);
    }
    .hero h1 {
      margin: 0 0 6px;
      font-size: 1.28rem;
    }
    .hero p {
      margin: 0 0 14px;
      font-size: 0.9rem;
      color: #DBEAFE;
    }
    .quick-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 18px;
      border-radius: 9px;
      font-weight: 700;
      font-size: 0.95rem;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: transform 0.08s ease, background 0.15s ease;
    }
    .btn:active { transform: scale(0.99); }
    .btn-download-blank {
      background: #FFFFFF;
      color: var(--navy-dark);
    }
    .btn-download-blank:hover { background: #EFF6FF; }
    .btn-primary {
      background: var(--green);
      color: #FFFFFF;
      font-size: 1rem;
      padding: 14px 24px;
      box-shadow: 0 4px 12px rgba(21, 128, 61, 0.25);
    }
    .btn-primary:hover { background: var(--green-hover); }
    .btn-secondary {
      background: var(--navy);
      color: #FFFFFF;
      padding: 14px 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .card h2 {
      margin: 0 0 14px;
      font-size: 1rem;
      color: var(--navy);
      border-bottom: 2px solid #E2E8F0;
      padding-bottom: 8px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
    }
    label {
      display: block;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--muted);
      margin-bottom: 4px;
    }
    input[type="text"], select {
      width: 100%;
      padding: 9px 11px;
      border: 1px solid var(--border);
      border-radius: 7px;
      font-size: 0.92rem;
      color: var(--text);
      background: #F8FAFC;
    }
    input[type="text"]:focus, select:focus {
      outline: none;
      border-color: var(--navy);
      background: #FFF;
    }
    .checks {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 18px;
      margin-top: 6px;
    }
    .checks label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      color: var(--text);
      cursor: pointer;
      margin: 0;
    }
    .sticky-actions {
      position: sticky;
      bottom: 10px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(6px);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 8px 24px rgba(15, 35, 66, 0.14);
    }
    .hint {
      font-size: 0.82rem;
      color: var(--muted);
    }
    #preview-container {
      display: none;
      margin-top: 18px;
    }
    #preview-container img {
      width: 100%;
      border-radius: 8px;
      border: 1px solid var(--border);
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>📄 Reçu et Attestation de Vente de Véhicule (PDF A4 — 1 page)</h1>
      <p>Téléchargez directement le modèle vierge remplissable OU remplissez vos informations ci-dessous pour télécharger votre PDF prêt à signer.</p>
      <div class="quick-bar">
        <a class="btn btn-download-blank" href="/download/modele" download="Recu_Vente_Voiture_Mali_Modele.pdf">
          ⬇️ Télécharger le modèle vierge (PDF)
        </a>
        <a class="btn" style="background:rgba(255,255,255,0.16);color:#fff;border:1px solid rgba(255,255,255,0.35);" href="/" target="_blank" rel="noopener">
          ↗️ Ouvrir en plein écran (nouvel onglet)
        </a>
      </div>
    </div>

    <form id="recu-form" method="POST" action="/api/generate">
      <div class="card">
        <h2>📌 Référence, Lieu et Date de la vente</h2>
        <div class="grid-3">
          <div>
            <label>Lieu de la vente</label>
            <input type="text" name="lieu_vente" value="Bamako" placeholder="Ex : Bamako" />
          </div>
          <div>
            <label>Date de la vente</label>
            <input type="text" name="date_vente" value="__TODAY__" placeholder="JJ/MM/AAAA" />
          </div>
          <div>
            <label>Heure de remise des clés</label>
            <input type="text" name="heure_vente" placeholder="Ex : 16h00" />
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h2>1. Le Vendeur (Cédant)</h2>
          <div style="display:grid; gap:10px;">
            <div>
              <label>Nom et Prénom(s)</label>
              <input type="text" name="vendeur_nom" placeholder="Ex : Moussa TRAORÉ" />
            </div>
            <div>
              <label>Pièce d'identité et N° (NINA / CNI / Passeport)</label>
              <input type="text" name="vendeur_piece" placeholder="Ex : NINA 1 92 04 ..." />
            </div>
            <div>
              <label>Délivrée le / Lieu</label>
              <input type="text" name="vendeur_delivree" placeholder="Ex : 14/05/2023 à Bamako" />
            </div>
            <div>
              <label>Téléphone</label>
              <input type="text" name="vendeur_tel" placeholder="Ex : +223 76 00 00 00" />
            </div>
            <div>
              <label>Domicile / Quartier & Ville</label>
              <input type="text" name="vendeur_adresse" placeholder="Ex : ACI 2000, Bamako" />
            </div>
          </div>
        </div>

        <div class="card">
          <h2>2. L'Acheteur (Acquéreur)</h2>
          <div style="display:grid; gap:10px;">
            <div>
              <label>Nom et Prénom(s)</label>
              <input type="text" name="acheteur_nom" placeholder="Ex : Amadou DIALLO" />
            </div>
            <div>
              <label>Pièce d'identité et N° (NINA / CNI / Passeport)</label>
              <input type="text" name="acheteur_piece" placeholder="Ex : CNI N° B-0849..." />
            </div>
            <div>
              <label>Délivrée le / Lieu</label>
              <input type="text" name="acheteur_delivree" placeholder="Ex : 08/11/2024 à Bamako" />
            </div>
            <div>
              <label>Téléphone</label>
              <input type="text" name="acheteur_tel" placeholder="Ex : +223 79 00 00 00" />
            </div>
            <div>
              <label>Domicile / Quartier & Ville</label>
              <input type="text" name="acheteur_adresse" placeholder="Ex : Kalaban Coura, Bamako" />
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>3. Désignation du Véhicule</h2>
        <div class="grid-2">
          <div>
            <label>Marque et Modèle</label>
            <input type="text" name="veh_marque" placeholder="Ex : Toyota RAV4 / Mercedes C300" />
          </div>
          <div>
            <label>Genre / Carrosserie</label>
            <input type="text" name="veh_carrosserie" placeholder="Ex : Berline / SUV 4x4" />
          </div>
          <div>
            <label>N° d'Immatriculation</label>
            <input type="text" name="veh_immat" placeholder="Ex : BA-4829-MD" />
          </div>
          <div>
            <label>Année / 1ère mise en circulation</label>
            <input type="text" name="veh_annee" placeholder="Ex : 2019" />
          </div>
          <div>
            <label>N° de Châssis (VIN / Série)</label>
            <input type="text" name="veh_chassis" placeholder="Ex : JTMBF4DV9KD049821" />
          </div>
          <div>
            <label>Énergie et Couleur</label>
            <input type="text" name="veh_energie" placeholder="Ex : Essence — Gris métallisé" />
          </div>
          <div>
            <label>Kilométrage affiché</label>
            <input type="text" name="veh_km" placeholder="Ex : 85 000 km" />
          </div>
          <div>
            <label>N° Carte Grise</label>
            <input type="text" name="veh_cg" placeholder="Optionnel" />
          </div>
        </div>
      </div>

      <div class="card">
        <h2>4. Prix en FCFA, Règlement et Documents remis</h2>
        <div class="grid-3">
          <div>
            <label>Prix de vente convenu (FCFA)</label>
            <input type="text" name="prix_vente" placeholder="Ex : 5500000" />
          </div>
          <div>
            <label>Montant versé ce jour (FCFA)</label>
            <input type="text" name="montant_verse" placeholder="Ex : 5500000" />
          </div>
          <div>
            <label>Reste à payer si acompte (FCFA)</label>
            <input type="text" name="reste_a_payer" placeholder="Laisser vide si soldé" />
          </div>
        </div>

        <div class="grid-2" style="margin-top:12px;">
          <div>
            <label>Mode de paiement</label>
            <select name="mode_paiement">
              <option value="especes">Espèces</option>
              <option value="mobile">Mobile Money (Orange / Moov / Wave)</option>
              <option value="virement">Virement bancaire</option>
              <option value="cheque">Chèque</option>
            </select>
          </div>
          <div>
            <label>Situation du règlement</label>
            <select name="statut_paiement">
              <option value="solde">Payé intégralement (Soldé — Reste 0 FCFA)</option>
              <option value="acompte">Acompte versé (Solde restant dû)</option>
            </select>
          </div>
        </div>

        <div style="margin-top:14px;">
          <label>Documents et clés remis à l'acheteur :</label>
          <div class="checks">
            <label><input type="checkbox" name="doc" value="carte grise" checked /> Carte grise</label>
            <label><input type="checkbox" name="doc" value="visite" checked /> Visite technique</label>
            <label><input type="checkbox" name="doc" value="vignette" checked /> Vignette</label>
            <label><input type="checkbox" name="doc" value="assurance" /> Assurance</label>
            <label><input type="checkbox" name="doc" value="douane" /> Dédouanement</label>
            <span style="display:inline-flex;align-items:center;gap:6px;">
              Nombre de clés :
              <input type="text" name="nombre_cles" value="02" style="width:60px;padding:5px 8px;" />
            </span>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>5. Témoins (Optionnel)</h2>
        <div class="grid-2">
          <div>
            <label>Témoin N° 1 — Nom & Prénom</label>
            <input type="text" name="temoin1_nom" placeholder="Optionnel" />
            <label style="margin-top:8px;">Témoin N° 1 — Téléphone</label>
            <input type="text" name="temoin1_tel" placeholder="Optionnel" />
          </div>
          <div>
            <label>Témoin N° 2 — Nom & Prénom</label>
            <input type="text" name="temoin2_nom" placeholder="Optionnel" />
            <label style="margin-top:8px;">Témoin N° 2 — Téléphone</label>
            <input type="text" name="temoin2_tel" placeholder="Optionnel" />
          </div>
        </div>
      </div>

      <div class="sticky-actions">
        <div class="hint">Le montant en chiffres est automatiquement écrit en toutes lettres sur le PDF.</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="afficherApercu()">
            👁️ Aperçu avant téléchargement
          </button>
          <button type="submit" class="btn btn-primary">
            ⬇️ Générer et Télécharger mon PDF
          </button>
        </div>
      </div>
    </form>

    <div id="preview-container" class="card">
      <h2>👁️ Aperçu exact de votre page A4</h2>
      <img id="preview-img" alt="Aperçu du reçu PDF" />
    </div>
  </div>

  <script>
    async function afficherApercu() {
      const form = document.getElementById('recu-form');
      const formData = new URLSearchParams(new FormData(form));
      const resp = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      if (resp.ok) {
        const data = await resp.json();
        const box = document.getElementById('preview-container');
        const img = document.getElementById('preview-img');
        img.src = 'data:image/png;base64,' + data.png_base64;
        box.style.display = 'block';
        box.scrollIntoView({ behavior: 'smooth' });
      }
    }
  </script>
</body>
</html>
"""


def parse_form_to_data(raw_body: str) -> dict:
    parsed = urllib.parse.parse_qs(raw_body, keep_blank_values=True)

    def g(key: str) -> str:
        return (parsed.get(key, [""])[0] or "").strip()

    return {
        "numero_recu": g("numero_recu"),
        "lieu_vente": g("lieu_vente"),
        "date_vente": g("date_vente"),
        "heure_vente": g("heure_vente"),
        "vendeur": {
            "nom": g("vendeur_nom"),
            "piece_identite": g("vendeur_piece"),
            "piece_delivree": g("vendeur_delivree"),
            "telephone": g("vendeur_tel"),
            "adresse": g("vendeur_adresse"),
        },
        "acheteur": {
            "nom": g("acheteur_nom"),
            "piece_identite": g("acheteur_piece"),
            "piece_delivree": g("acheteur_delivree"),
            "telephone": g("acheteur_tel"),
            "adresse": g("acheteur_adresse"),
        },
        "vehicule": {
            "marque_modele": g("veh_marque"),
            "carrosserie": g("veh_carrosserie"),
            "immatriculation": g("veh_immat"),
            "annee": g("veh_annee"),
            "chassis": g("veh_chassis"),
            "energie_couleur": g("veh_energie"),
            "kilometrage": g("veh_km"),
            "carte_grise_num": g("veh_cg"),
        },
        "paiement": {
            "prix_vente": g("prix_vente"),
            "montant_verse": g("montant_verse"),
            "reste_a_payer": g("reste_a_payer"),
            "mode": g("mode_paiement"),
            "statut": g("statut_paiement"),
        },
        "documents_remis": parsed.get("doc", []),
        "nombre_cles": g("nombre_cles"),
        "temoins": [
            {"nom": g("temoin1_nom"), "telephone": g("temoin1_tel")},
            {"nom": g("temoin2_nom"), "telephone": g("temoin2_tel")},
        ],
    }


class RecuRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[RecuWeb] {self.address_string()} - {fmt % args}", flush=True)

    def _serve_get_or_head(self, send_body: bool = True):
        path = urllib.parse.urlparse(self.path).path
        if path in ("/", "/index.html"):
            today = datetime.now().strftime("%d/%m/%Y")
            body = HTML_PAGE.replace("__TODAY__", today).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if send_body:
                self.wfile.write(body)
        elif path == "/download/modele":
            if not os.path.exists(BLANK_PDF_PATH):
                generer_recu_pdf(BLANK_PDF_PATH, data={}, fillable=True)
            with open(BLANK_PDF_PATH, "rb") as f:
                pdf_bytes = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header(
                "Content-Disposition",
                'attachment; filename="Recu_Vente_Voiture_Mali_Modele.pdf"',
            )
            self.send_header("Content-Length", str(len(pdf_bytes)))
            self.end_headers()
            if send_body:
                self.wfile.write(pdf_bytes)
        else:
            self.send_response(404)
            self.end_headers()

    def do_HEAD(self):
        self._serve_get_or_head(send_body=False)

    def do_GET(self):
        self._serve_get_or_head(send_body=True)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length).decode("utf-8", errors="replace")
        data = parse_form_to_data(raw_body)

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_pdf = tmp.name

        try:
            generer_recu_pdf(tmp_pdf, data=data, fillable=False)
            if path == "/api/generate":
                # Sauvegarde aussi dans le dossier du projet pour accès direct
                saved_copy = os.path.join(BASE_DIR, "Recu_Vente_Voiture_Rempli.pdf")
                with open(tmp_pdf, "rb") as f:
                    pdf_bytes = f.read()
                with open(saved_copy, "wb") as out_f:
                    out_f.write(pdf_bytes)

                self.send_response(200)
                self.send_header("Content-Type", "application/pdf")
                self.send_header(
                    "Content-Disposition",
                    'attachment; filename="Recu_Vente_Voiture_Rempli.pdf"',
                )
                self.send_header("Content-Length", str(len(pdf_bytes)))
                self.end_headers()
                self.wfile.write(pdf_bytes)
            elif path == "/api/preview":
                import base64
                doc = pymupdf.open(tmp_pdf)
                pix = doc[0].get_pixmap(dpi=150)
                png_b64 = base64.b64encode(pix.tobytes("png")).decode("ascii")
                payload = json.dumps({"png_base64": png_b64}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            else:
                self.send_response(404)
                self.end_headers()
        finally:
            if os.path.exists(tmp_pdf):
                os.remove(tmp_pdf)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8000), RecuRequestHandler)
    print("Serveur démarré sur http://0.0.0.0:8000", flush=True)
    server.serve_forever()
