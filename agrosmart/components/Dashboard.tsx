"use client";

/**
 * Dashboard.tsx — AgroSmart · Tableau de bord géospatial interactif
 *
 * Architecture :
 *  - Navbar  (64 px) en haut   : brand, contexte, actions utilisateur.
 *  - Sidebar (350 px) à gauche : contrôles de simulation et résultats.
 *  - Carte Leaflet plein-écran à droite.
 *
 * Isolation SSR :
 *  - Tout le code Leaflet/react-leaflet est dans LeafletMap.tsx.
 *  - Il est importé ici via `next/dynamic(..., { ssr: false })`.
 *  - Ce fichier ne contient aucun import Leaflet et est sûr côté serveur.
 *
 * Contrat API — POST /predict?region=souss_massa&date=<YYYY-MM> :
 *  {
 *    "success": true,
 *    "image":   "<base64 PNG>",
 *    "bounds":  [[south, west], [north, east]],
 *    "region":  "souss_massa",
 *    "date":    "2024-05",
 *    "class_distribution": { "0": 0.12, "1": 0.34, "2": 0.34, "3": 0.20 }
 *  }
 */

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { UserButton } from "@clerk/nextjs";
import { useAuthenticatedFetch } from "@/lib/api";
import {
  Download,
  LogOut,
  RefreshCw,
  Play,
  Globe,
  Calendar,
  Activity,
  CheckCircle2,
  Layers,
  Compass,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Skeleton, SkeletonBlock } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { AgrosmartLogo, agrosmartIconHtml } from "@/components/ui/AgrosmartLogo";

import type { PredictionResult, MapPanelProps } from "@/components/LeafletMap";

// ── MapPanel — import dynamique (ssr:false) ────────────────────────────────────

const MapPanel = dynamic<MapPanelProps>(
  () => import("@/components/LeafletMap"),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: "#0a0f14" }}
      >
        <div className="flex flex-col items-center gap-3">
          <svg
            className="h-6 w-6 text-[#00c896]"
            style={{ animation: "spin 1.2s linear infinite" }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="31 31"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-xs text-[#5a5a6a]">Chargement de la carte…</span>
        </div>
      </div>
    ),
  },
);

// ── Constantes ─────────────────────────────────────────────────────────────────

const REGION_GLOBAL = "souss_massa" as const;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const SIMULATION_PERIODS = [
  { value: "2024-01", label: "Janvier 2024" },
  { value: "2024-05", label: "Mai 2024" },
  { value: "2024-08", label: "Août 2024" },
  { value: "2025-05", label: "Mai 2025" },
  { value: "2025-09", label: "Septembre 2025" },
  { value: "2026-02", label: "Février 2026" },
  { value: "2026-05", label: "Mai 2026" },
] as const;

type PeriodValue = (typeof SIMULATION_PERIODS)[number]["value"];

function formatPeriodLabel(value: string): string {
  return SIMULATION_PERIODS.find((p) => p.value === value)?.label ?? value;
}

const STRESS_CLASSES = [
  { id: 0, label: "Sain (Irrigué)",  color: "#2ecc71", desc: "Bien irrigué" },
  { id: 1, label: "Stress Léger",    color: "#3498db", desc: "Déficit hydrique faible" },
  { id: 2, label: "Stress Modéré",   color: "#f39c12", desc: "Stress hydrique significatif" },
  { id: 3, label: "Stress Critique", color: "#960000", desc: "Critique — irrigation urgente" },
] as const;

// ── Génération du rapport PDF ──────────────────────────────────────────────────

function generateAndDownloadReport(
  prediction: PredictionResult,
  periodLabel: string,
): void {
  const dist   = prediction.class_distribution ?? {};
  const bounds = prediction.bounds;

  const generatedAt = new Date().toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const criticalPct = (dist["3"] ?? 0) * 100;
  const moderatePct = (dist["2"] ?? 0) * 100;
  const lightPct    = (dist["1"] ?? 0) * 100;
  const healthyPct  = (dist["0"] ?? 0) * 100;

  // Interprétation automatique basée sur la distribution réelle
  let interpretation: string;
  if (criticalPct > 40) {
    interpretation = `La majorité de la zone analysée (${criticalPct.toFixed(1)} %) présente un stress hydrique critique. Une planification d'urgence de l'irrigation est fortement recommandée pour la période ${periodLabel}. Les zones en classe 3 nécessitent une intervention immédiate afin de préserver les cultures et les ressources en eau souterraine.`;
  } else if (moderatePct + criticalPct > 50) {
    interpretation = `Plus de la moitié de la surface analysée présente un stress hydrique significatif (modéré à critique) pour la période ${periodLabel}. Une révision du calendrier d'irrigation est conseillée, avec une attention prioritaire aux zones en stress critique (${criticalPct.toFixed(1)} %) et modéré (${moderatePct.toFixed(1)} %).`;
  } else if (healthyPct > 60) {
    interpretation = `La zone du Souss-Massa présente majoritairement des conditions hydriques satisfaisantes pour la période ${periodLabel}, avec ${healthyPct.toFixed(1)} % de surface saine ou légèrement stressée. Un suivi régulier reste recommandé pour les parcelles en stress modéré à critique.`;
  } else {
    interpretation = `La zone d'analyse présente une distribution mixte de stress hydrique pour la période ${periodLabel}. Un diagnostic parcellaire approfondi est recommandé, avec une attention portée aux zones en stress modéré (${moderatePct.toFixed(1)} %) et critique (${criticalPct.toFixed(1)} %).`;
  }

  const recommendations: string[] = [];
  if (criticalPct > 20) recommendations.push(`Déclencher un programme d'irrigation d'urgence pour les zones de classe 3 (${criticalPct.toFixed(1)} % de la surface).`);
  if (moderatePct > 25) recommendations.push(`Optimiser les calendriers d'irrigation pour les zones en stress modéré (classe 2 : ${moderatePct.toFixed(1)} %).`);
  if (lightPct    > 25) recommendations.push(`Surveiller l'évolution des zones en stress léger (classe 1 : ${lightPct.toFixed(1)} %) pour anticiper leur dégradation.`);
  if (healthyPct  > 40) recommendations.push(`Maintenir les pratiques d'irrigation actuelles pour les zones saines (classe 0 : ${healthyPct.toFixed(1)} %).`);
  recommendations.push("Réévaluation recommandée après la prochaine période d'acquisition de données satellites.");

  // Lignes du tableau de statistiques
  const statsRows = STRESS_CLASSES.map(({ id, color, label, desc }) => {
    const pct = (dist[String(id)] ?? 0) * 100;
    const bar = Math.min(pct, 100).toFixed(1);
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;white-space:nowrap;">
          <span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${color};vertical-align:middle;margin-right:8px;flex-shrink:0;"></span>Classe ${id}
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;">
          <strong style="color:#0f172a;display:block;">${label}</strong>
          <span style="font-size:9px;color:#64748b;">${desc}</span>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:700;color:#0f172a;font-family:monospace;white-space:nowrap;">${pct.toFixed(2)} %</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;min-width:110px;">
          <div style="background:#f1f5f9;border-radius:4px;height:6px;width:100%;">
            <div style="background:${color};height:6px;border-radius:4px;width:${bar}%;"></div>
          </div>
        </td>
      </tr>`;
  }).join("");

  const recsHtml = recommendations.map(r => `
    <li style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:11px;color:#334155;list-style:none;">
      <span style="color:#00c896;font-size:15px;line-height:1.2;flex-shrink:0;">›</span><span>${r}</span>
    </li>`).join("");

  const legendHtml = STRESS_CLASSES.map(({ id, color, label, desc }) => `
    <div style="display:flex;align-items:center;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:10px 13px;">
      <div style="width:13px;height:13px;border-radius:3px;background:${color};flex-shrink:0;"></div>
      <div>
        <div style="font-size:11px;font-weight:600;color:#0f172a;margin-bottom:2px;">Classe ${id} — ${label}</div>
        <div style="font-size:9px;color:#64748b;">${desc}</div>
      </div>
    </div>`).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rapport AgroSmart AI — ${periodLabel}</title>
  <style>
    @page { size: A4; margin: 16mm 14mm 20mm 14mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; background: #fff; font-size: 11px; line-height: 1.65; }
    @media print {
      .no-print { display: none !important; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .cover { page-break-after: always; min-height: 100vh; }
    }
  </style>
</head>
<body>

  <!-- Toolbar (masqué à l'impression) -->
  <div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:999;background:#111114;padding:11px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e1e24;box-shadow:0 2px 12px rgba(0,0,0,0.4);">
    <div style="font-family:system-ui;font-size:13px;font-weight:600;color:#f4f4f6;display:flex;align-items:center;gap:10px;">
      ${agrosmartIconHtml(28)}
      <span style="font-weight:600;letter-spacing:-0.025em;">agrosmart</span>
      <span style="color:#2a2a33;">·</span>
      <span style="color:#5a5a6a;font-weight:400;font-size:12px;">Aperçu du rapport · ${periodLabel}</span>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#00c896;color:#0a0a0b;border:none;padding:8px 18px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;font-family:system-ui;letter-spacing:0.2px;">
        ↓ Télécharger en PDF
      </button>
      <button onclick="window.close()" style="background:transparent;color:#9898a8;border:1px solid #2a2a33;padding:8px 14px;border-radius:7px;font-size:12px;cursor:pointer;font-family:system-ui;">
        Fermer
      </button>
    </div>
  </div>

  <!-- PAGE DE COUVERTURE -->
  <div class="cover" style="min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:linear-gradient(145deg,#07070a 0%,#0b1d18 55%,#0e2820 100%);color:#fff;padding:80px 48px;">
    <div style="margin:0 auto 20px;display:flex;justify-content:center;">${agrosmartIconHtml(64)}</div>
    <div style="font-size:10px;color:#4a4a5a;letter-spacing:3.5px;text-transform:uppercase;margin-bottom:40px;font-family:monospace;">AgroSmart AI · Intelligence Hydro-Climatique</div>
    <div style="width:36px;height:2px;background:#00c896;margin:0 auto 32px;"></div>
    <h1 style="font-size:32px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:14px;letter-spacing:-0.5px;">Rapport de Cartographie<br>du Stress Hydrique</h1>
    <p style="font-size:14px;color:#9898a8;margin-bottom:56px;letter-spacing:0.3px;">Région du Souss-Massa · Maroc</p>
    <div style="display:flex;gap:0;border:1px solid #1e1e24;border-radius:12px;overflow:hidden;background:rgba(255,255,255,0.03);">
      <div style="padding:18px 28px;text-align:center;">
        <div style="font-size:9px;color:#4a4a5a;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:7px;">Région</div>
        <div style="font-size:14px;color:#00c896;font-weight:700;">Souss-Massa</div>
      </div>
      <div style="width:1px;background:#1e1e24;"></div>
      <div style="padding:18px 28px;text-align:center;">
        <div style="font-size:9px;color:#4a4a5a;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:7px;">Période</div>
        <div style="font-size:14px;color:#00c896;font-weight:700;">${periodLabel}</div>
      </div>
      <div style="width:1px;background:#1e1e24;"></div>
      <div style="padding:18px 28px;text-align:center;">
        <div style="font-size:9px;color:#4a4a5a;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:7px;">Modèle IA</div>
        <div style="font-size:14px;color:#00c896;font-weight:700;">U-Net 2D</div>
      </div>
    </div>
    <div style="margin-top:52px;font-size:10px;color:#3a3a47;letter-spacing:0.5px;">Généré automatiquement le ${generatedAt}</div>
  </div>

  <!-- Spacer toolbar (masqué à l'impression) -->
  <div class="no-print" style="height:52px;"></div>

  <!-- CONTENU DU RAPPORT -->
  <div style="padding:36px 0 0;">

    <!-- § 1 — Résumé Exécutif -->
    <div style="margin-bottom:30px;">
      <div style="font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1.5px;border-left:3px solid #00c896;padding-left:10px;margin-bottom:14px;">Résumé Exécutif</div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:17px 20px;">
        <p style="font-size:11px;color:#334155;margin-bottom:9px;">Ce rapport présente les résultats de l'analyse du stress hydrique réalisée par le système <strong>AgroSmart AI</strong> sur la région du Souss-Massa, l'un des bassins agricoles les plus productifs du Maroc.</p>
        <p style="font-size:11px;color:#334155;margin-bottom:9px;">Le modèle <strong>U-Net 2D</strong> (Macro F1-Score : 92,40 %) a été appliqué à une pile de données multi-sources (Sentinel-2, Landsat 8 TIRS, CHIRPS, ERA5-Land) pour produire une cartographie sémantique du stress hydrique à l'échelle régionale pour la période <strong>${periodLabel}</strong>.</p>
        <p style="font-size:11px;color:#334155;">L'objectif est de fournir aux décideurs, agronomes et gestionnaires des ressources en eau une aide à la décision pour l'optimisation de l'irrigation et la préservation des nappes phréatiques du bassin.</p>
      </div>
    </div>

    <!-- § 2 — Informations de la Simulation -->
    <div style="margin-bottom:30px;">
      <div style="font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1.5px;border-left:3px solid #00c896;padding-left:10px;margin-bottom:14px;">Informations de la Simulation</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:13px 15px;">
          <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Région analysée</div>
          <div style="font-size:12px;color:#0f172a;font-weight:600;">Souss-Massa (Globale)</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:13px 15px;">
          <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Période d'analyse</div>
          <div style="font-size:12px;color:#0f172a;font-weight:600;">${periodLabel}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:13px 15px;">
          <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Modèle d'intelligence artificielle</div>
          <div style="font-size:12px;color:#0f172a;font-weight:600;">U-Net 2D — Segmentation Sémantique</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:13px 15px;">
          <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Statut de la prédiction</div>
          <div style="font-size:12px;font-weight:600;margin-top:1px;">
            <span style="display:inline-flex;align-items:center;gap:5px;background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:20px;font-size:10px;">
              <span style="width:6px;height:6px;background:#16a34a;border-radius:50%;display:inline-block;"></span>Succès
            </span>
          </div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:13px 15px;">
          <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Performance du modèle</div>
          <div style="font-size:12px;color:#0f172a;font-weight:600;">Macro F1-Score : 92,40 %</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:13px 15px;">
          <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Sources de données</div>
          <div style="font-size:12px;color:#0f172a;font-weight:600;">Sentinel-2 · Landsat 8 · CHIRPS · ERA5-Land</div>
        </div>
      </div>
    </div>

    <!-- § 3 — Statistiques Globales -->
    <div style="margin-bottom:30px;">
      <div style="font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1.5px;border-left:3px solid #00c896;padding-left:10px;margin-bottom:14px;">Statistiques Globales des Pixels</div>
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="text-align:left;padding:10px 14px;font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Classe</th>
            <th style="text-align:left;padding:10px 14px;font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Désignation</th>
            <th style="text-align:left;padding:10px 14px;font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;">Pourcentage</th>
            <th style="text-align:left;padding:10px 14px;font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;width:130px;">Distribution</th>
          </tr>
        </thead>
        <tbody>${statsRows}</tbody>
      </table>
    </div>

    <!-- § 4 — Emprise Géographique -->
    <div style="margin-bottom:30px;">
      <div style="font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1.5px;border-left:3px solid #00c896;padding-left:10px;margin-bottom:14px;">Emprise Géographique (WGS-84)</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <tbody>
          <tr><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;font-weight:500;width:55%;">Latitude Nord</td><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#0f172a;font-family:monospace;font-weight:600;text-align:right;">${bounds[1][0].toFixed(6)}°</td></tr>
          <tr><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;font-weight:500;">Latitude Sud</td><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#0f172a;font-family:monospace;font-weight:600;text-align:right;">${bounds[0][0].toFixed(6)}°</td></tr>
          <tr><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;font-weight:500;">Longitude Est</td><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#0f172a;font-family:monospace;font-weight:600;text-align:right;">${bounds[1][1].toFixed(6)}°</td></tr>
          <tr><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;font-weight:500;">Longitude Ouest</td><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#0f172a;font-family:monospace;font-weight:600;text-align:right;">${bounds[0][1].toFixed(6)}°</td></tr>
          <tr><td style="padding:9px 14px;font-size:11px;color:#64748b;font-weight:500;">Système de référence</td><td style="padding:9px 14px;font-size:11px;color:#0f172a;font-family:monospace;font-weight:600;text-align:right;">WGS 84 / EPSG:4326</td></tr>
        </tbody>
      </table>
    </div>

    <!-- § 5 — Interprétation -->
    <div style="margin-bottom:30px;">
      <div style="font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1.5px;border-left:3px solid #00c896;padding-left:10px;margin-bottom:14px;">Interprétation &amp; Recommandations</div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:7px;padding:15px 17px;margin-bottom:14px;">
        <p style="font-size:11px;color:#78350f;line-height:1.75;">${interpretation}</p>
      </div>
      <ul style="list-style:none;padding:0;margin:0;">${recsHtml}</ul>
    </div>

    <!-- § 6 — Légende -->
    <div style="margin-bottom:30px;">
      <div style="font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1.5px;border-left:3px solid #00c896;padding-left:10px;margin-bottom:14px;">Légende des Classes de Stress Hydrique</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${legendHtml}</div>
    </div>

    <!-- Pied de page -->
    <div style="margin-top:36px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:7px;">${agrosmartIconHtml(20)}<span style="font-size:12px;font-weight:600;color:#f4f8f6;letter-spacing:-0.025em;">agrosmart</span></div>
      <div style="font-size:9px;color:#94a3b8;text-align:right;line-height:1.7;">
        Rapport généré automatiquement · ${generatedAt}<br>
        Modèle U-Net 2D · Données satellites multi-sources · Souss-Massa, Maroc
      </div>
    </div>
  </div>

</body>
</html>`;

  const popup = window.open("", "_blank", "width=980,height=740,scrollbars=yes,resizable=yes");
  if (!popup) {
    alert("Veuillez autoriser les popups pour générer le rapport.");
    return;
  }
  popup.document.write(html);
  popup.document.close();
  popup.focus();
}

// ── SidebarProps ───────────────────────────────────────────────────────────────

interface SidebarProps {
  period: PeriodValue | string;
  onPeriodChange: (p: string) => void;
  onRunSimulation: () => void;
  loading: boolean;
  prediction: PredictionResult | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar({
  period,
  onPeriodChange,
  onRunSimulation,
  loading,
  prediction,
  sidebarOpen,
  onToggleSidebar,
}: SidebarProps) {
  return (
    <>
      {/* ── Bouton collapse / expand ────────────────────────────────── */}
      <button
        onClick={onToggleSidebar}
        className="absolute top-1/2 -translate-y-1/2 z-[1000] flex items-center justify-center h-9 w-5 rounded-r-lg border border-l-0 border-[#1e1e24] bg-[#111114] text-[#5a5a6a] hover:text-[#f4f4f6] hover:bg-[#1a1a20] transition-all duration-200"
        style={{ left: sidebarOpen ? 350 : 0 }}
        title={sidebarOpen ? "Réduire le panneau" : "Ouvrir le panneau"}
        aria-label={sidebarOpen ? "Réduire le panneau" : "Ouvrir le panneau"}
      >
        {sidebarOpen
          ? <ChevronLeft className="h-3 w-3" />
          : <ChevronRight className="h-3 w-3" />
        }
      </button>

      {/* ── Panneau latéral ─────────────────────────────────────────── */}
      <aside
        className="absolute top-0 left-0 h-full z-[999] flex flex-col border-r border-[#1a1a20] overflow-hidden transition-transform duration-300 ease-in-out"
        style={{
          width: 350,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-350px)",
          background: "#0d0d10",
        }}
        aria-hidden={!sidebarOpen}
      >
        {/* ── Corps défilable ─────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-5
            [&::-webkit-scrollbar]:w-[3px]
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-[#2a2a33]
            [&::-webkit-scrollbar-thumb:hover]:bg-[#3a3a47]
            [&::-webkit-scrollbar-thumb]:rounded-full"
        >

          {/* ── Région Cible ─────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-[#4a4a5a]" />
              <span className="text-[9px] font-semibold text-[#4a4a5a] uppercase tracking-[0.14em]">
                Région Cible
              </span>
            </div>
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[rgba(0,200,150,0.05)] border border-[rgba(0,200,150,0.14)]">
              <div className="h-8 w-8 rounded-lg bg-[rgba(0,200,150,0.1)] flex items-center justify-center shrink-0">
                <Globe className="h-3.5 w-3.5 text-[#00c896]" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#f4f4f6] leading-tight">Souss-Massa</p>
                <p className="text-[10px] text-[#5a5a6a] leading-tight mt-0.5">Toutes provinces · Maroc</p>
              </div>
            </div>
          </div>

          {/* ── Période ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-[#4a4a5a]" />
              <span className="text-[9px] font-semibold text-[#4a4a5a] uppercase tracking-[0.14em]">
                Période d&apos;analyse
              </span>
            </div>
            <div className="relative">
              <select
                id="sim-period"
                value={period}
                onChange={(e) => onPeriodChange(e.target.value)}
                disabled={loading}
                className="h-9 w-full rounded-lg border border-[#1e1e24] bg-[#0a0a0e] pl-3.5 pr-8 text-[13px] text-[#f4f4f6] outline-none appearance-none cursor-pointer transition-all duration-200 hover:border-[#2a2a33] focus:border-[#00c896] focus:ring-1 focus:ring-[rgba(0,200,150,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {SIMULATION_PERIODS.map(({ value, label }) => (
                  <option key={value} value={value} className="bg-[#0a0a0e] text-[#f4f4f6]">
                    {label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg className="h-3 w-3 text-[#4a4a5a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
            <p className="text-[10px] text-[#3a3a47]">
              7 périodes disponibles · Données satellites exportées
            </p>
          </div>

          {/* ── Bouton Simulation ─────────────────────────────────── */}
          <button
            onClick={onRunSimulation}
            disabled={loading}
            className="w-full h-10 rounded-lg bg-[#00c896] text-[#0a0a0b] font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-[#00b484] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="28 28" strokeLinecap="round" />
                </svg>
                Simulation en cours…
              </>
            ) : prediction ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Relancer la simulation
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Lancer la Simulation IA
              </>
            )}
          </button>

          {/* ── Skeletons (inférence en cours) ───────────────────── */}
          {loading && (
            <div className="flex flex-col gap-3">
              <SkeletonBlock rows={2} />
              <div>
                <Skeleton className="h-3 w-1/3 mb-2.5" />
                <div className="flex flex-col gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-9 rounded-lg" />
                  ))}
                </div>
              </div>
              <SkeletonBlock rows={4} />
            </div>
          )}

          {/* ── Résultats de la simulation ───────────────────────── */}
          {!loading && prediction && (
            <div className="flex flex-col gap-4">

              {/* Carte de succès */}
              <div className="rounded-xl border border-[rgba(0,200,150,0.18)] bg-[rgba(0,200,150,0.04)] p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#00c896] shrink-0" />
                  <span className="text-[13px] font-semibold text-[#00c896]">Simulation complète</span>
                </div>
                <div className="flex flex-col gap-1.5 border-t border-[rgba(0,200,150,0.1)] pt-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#5a5a6a]">Région</span>
                    <span className="text-[11px] text-[#f4f4f6] font-medium">Souss-Massa (Globale)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#5a5a6a]">Période</span>
                    <span className="text-[11px] text-[#f4f4f6] font-medium">
                      {formatPeriodLabel(prediction.date)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Distribution des pixels */}
              {prediction.class_distribution && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-[#4a4a5a]" />
                    <span className="text-[9px] font-semibold text-[#4a4a5a] uppercase tracking-[0.14em]">
                      Distribution des Pixels
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {STRESS_CLASSES.map(({ id, color, label }) => {
                      const pct = (prediction.class_distribution?.[String(id)] ?? 0) * 100;
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#111114] border border-[#1a1a20] hover:border-[#252530] transition-colors"
                        >
                          <div
                            className="h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ background: color }}
                          />
                          <span className="text-[11px] text-[#9898a8] flex-1 min-w-0 truncate">
                            {label}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-14 h-1 rounded-full bg-[#1e1e24] overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, background: color }}
                              />
                            </div>
                            <span className="text-[11px] font-mono font-semibold text-[#f4f4f6] w-9 text-right">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Emprise Géographique */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Compass className="h-3 w-3 text-[#4a4a5a]" />
                  <span className="text-[9px] font-semibold text-[#4a4a5a] uppercase tracking-[0.14em]">
                    Emprise Géographique (WGS-84)
                  </span>
                </div>
                <div className="rounded-lg border border-[#1a1a20] bg-[#111114] divide-y divide-[#1a1a20] overflow-hidden">
                  {[
                    { dir: "↑ Nord",  val: prediction.bounds[1][0] },
                    { dir: "↓ Sud",   val: prediction.bounds[0][0] },
                    { dir: "→ Est",   val: prediction.bounds[1][1] },
                    { dir: "← Ouest", val: prediction.bounds[0][1] },
                  ].map(({ dir, val }) => (
                    <div key={dir} className="flex items-center justify-between px-3.5 py-2">
                      <span className="text-[11px] text-[#5a5a6a]">{dir}</span>
                      <span className="text-[11px] font-mono font-medium text-[#f4f4f6]">
                        {val.toFixed(4)}°
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bouton télécharger le rapport */}
              <button
                onClick={() => generateAndDownloadReport(prediction, formatPeriodLabel(period))}
                className="w-full h-9 rounded-lg border border-[#2a2a33] bg-[#111114] text-[11px] text-[#9898a8] font-medium flex items-center justify-center gap-2 hover:border-[rgba(0,200,150,0.4)] hover:text-[#00c896] hover:bg-[rgba(0,200,150,0.04)] transition-all duration-200"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger le rapport
              </button>

            </div>
          )}

          {/* ── Légende des classes (toujours visible) ───────────── */}
          {!loading && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-[#4a4a5a]" />
                <span className="text-[9px] font-semibold text-[#4a4a5a] uppercase tracking-[0.14em]">
                  Légende — Classes de Stress
                </span>
              </div>
              <div className="rounded-xl border border-[#1a1a20] bg-[#111114] overflow-hidden">
                {STRESS_CLASSES.map((cls, i) => (
                  <div
                    key={cls.id}
                    className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-[#18181c] ${
                      i < STRESS_CLASSES.length - 1 ? "border-b border-[#1a1a20]" : ""
                    }`}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ background: cls.color }}
                    />
                    <div className="flex flex-col gap-px">
                      <span className="text-[11px] font-medium text-[#e4e4ea]">{cls.label}</span>
                      <span className="text-[9px] text-[#4a4a5a]">{cls.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Pied de page ─────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-[#1a1a20] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-[#3a3a47]" />
            <span className="text-[10px] text-[#3a3a47] font-mono">U-Net · F1 = 92,4%</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00c896] animate-pulse" />
              <span className="text-[10px] text-[#00c896] font-medium">Modèle prêt</span>
            </div>
            <span className="text-[#2a2a33]">·</span>
            <span className="text-[10px] text-[#3a3a47]">:8000</span>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Dashboard principal ────────────────────────────────────────────────────────

interface DashboardProps {
  onSignOut: () => void;
}

export default function Dashboard({ onSignOut }: DashboardProps) {
  const { toast }      = useToast();
  const { authFetch }  = useAuthenticatedFetch();

  const [period, setPeriod]           = useState<string>(SIMULATION_PERIODS[0].value);
  const [loading, setLoading]         = useState<boolean>(false);
  const [prediction, setPrediction]   = useState<PredictionResult | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  /**
   * Lance la prédiction U-Net via le backend FastAPI.
   * La région est toujours "souss_massa" (simulation globale).
   * authFetch injecte automatiquement le JWT Clerk dans Authorization: Bearer.
   */
  const handleRunSimulation = useCallback(async () => {
    if (!period) return;

    setLoading(true);
    setPrediction(null);

    try {
      const url =
        `${API_BASE}/predict` +
        `?region=${encodeURIComponent(REGION_GLOBAL)}` +
        `&date=${encodeURIComponent(period)}`;

      const response = await authFetch(url, { method: "POST" });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const errBody = await response.json();
          detail = errBody?.detail ?? detail;
        } catch { /* Corps non-JSON */ }
        throw new Error(detail);
      }

      const data: PredictionResult = await response.json();

      if (!data.success) {
        throw new Error("Le backend a renvoyé success: false");
      }
      if (!data.image || !data.bounds) {
        throw new Error("Réponse malformée : champs image ou bounds manquants");
      }

      setPrediction(data);
      toast(
        `Simulation complète — overlay projeté sur Souss-Massa (${formatPeriodLabel(period)})`,
        "success",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inattendue";
      toast(`Simulation échouée : ${msg}`, "error");
      console.error("[AgroSmart] handleRunSimulation:", err);
    } finally {
      setLoading(false);
    }
  }, [period, toast, authFetch]);

  return (
    <div className="h-full w-full relative overflow-hidden" style={{ background: "#0a0f14" }}>

      {/* Repositionne les contrôles Leaflet sous la navbar et à droite de la sidebar */}
      <style>{`
        .leaflet-top.leaflet-left {
          top: 12px !important;
          left: ${sidebarOpen ? 362 : 12}px !important;
          transition: left 0.3s ease-in-out;
        }
        .leaflet-top.leaflet-right  { top: 12px !important; }
        .leaflet-bottom.leaflet-right { bottom: 20px !important; }
      `}</style>

      {/* ── Navbar (64 px) ──────────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 z-[1001] flex items-center justify-between px-6 border-b border-[#1a1a20]"
        style={{
          height: 64,
          background: "rgba(8,8,10,0.96)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Gauche : Brand + contexte */}
        <div className="flex flex-col gap-1">
          <AgrosmartLogo variant="wordmark" theme="dark" iconSize={28} />
          <span className="text-[10px] text-[#4a4a5a] leading-none" style={{ paddingLeft: 37 }}>
            Stress Hydrique — Souss-Massa
          </span>
        </div>

        {/* Droite : Statut API + User + Déconnexion */}
        <div className="flex items-center gap-3">

          {/* Statut API (discret) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[rgba(0,200,150,0.06)] border border-[rgba(0,200,150,0.14)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00c896] animate-pulse shrink-0" />
            <span className="text-[10px] font-medium text-[#00c896]">API active</span>
          </div>

          {/* Clerk UserButton */}
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-7 w-7",
              },
            }}
          />

          {/* Déconnexion */}
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#9898a8] border border-[#1e1e24] hover:border-[#2a2a33] hover:text-[#f4f4f6] hover:bg-[#1a1a20] transition-all duration-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>

        </div>
      </div>

      {/* ── Zone principale (sous la navbar de 64 px) ───────────────────── */}
      <div className="absolute inset-0 top-[64px]">

        {/* Carte Leaflet — rendue côté client uniquement */}
        <MapPanel prediction={prediction} />

        {/* Panneau de contrôle */}
        <Sidebar
          period={period}
          onPeriodChange={setPeriod}
          onRunSimulation={handleRunSimulation}
          loading={loading}
          prediction={prediction}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />

        {/* Indicateur "première simulation" */}
        {!prediction && !loading && (
          <div
            className="absolute bottom-6 z-[998] pointer-events-none"
            style={{
              left: "50%",
              transform: `translateX(calc(-50% + ${sidebarOpen ? 175 : 0}px))`,
              transition: "transform 0.3s ease-in-out",
            }}
          >
            <div
              className="rounded-full px-5 py-2.5 flex items-center gap-2 text-[12px] text-[#9898a8]"
              style={{
                background: "rgba(13,13,16,0.88)",
                border: "1px solid #1e1e24",
                backdropFilter: "blur(10px)",
              }}
            >
              <svg className="h-3.5 w-3.5 text-[#00c896]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
              Sélectionnez une période et lancez la simulation pour voir la prédiction
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
