"use client";

import { AgrosmartLogo } from "@/components/ui/AgrosmartLogo";
import {
  ArrowRight, Droplets, Sprout, Tractor,
  Wheat, TrendingDown, ThermometerSun, Gauge,
  Network, Target, Award, Activity, Zap,
} from "lucide-react";

interface LandingProps {
  isAuthenticated: boolean;
  onLaunch: () => void;
  onRegister?: () => void;
}

export default function Landing({ isAuthenticated, onLaunch, onRegister }: LandingProps) {
  return (
    <div className="page">

      {/* ════ 1 · NAVBAR ════ */}
      <header className="nav">
        <div className="container nav-inner">
          <div className="brand">
            <AgrosmartLogo variant="icon" iconSize={38} />
            <div className="brand-name">AgroSmart<b> AI</b></div>
          </div>
          <nav className="nav-links nav-center">
            <a className="lnk" href="#about">À propos</a>
            <a className="lnk" href="#region">Souss-Massa</a>
            <a className="lnk" href="#model">Le modèle</a>
            <a className="lnk" href="#perf">Performances</a>
          </nav>
          <div className="nav-actions">
            <button className="btn btn-ghost btn-h10" onClick={onLaunch}>
              {isAuthenticated ? "Dashboard" : "Connexion"}
            </button>
            {!isAuthenticated && (
              <button className="btn btn-mint btn-h10" onClick={onRegister ?? onLaunch}>
                Inscription
              </button>
            )}
          </div>
        </div>
      </header>

      <main>

        {/* ════ 2 · HERO ════ */}
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="badge"><span className="dot" />Macro F1-Score · 92,40 %</span>
              <h1>Prédire le <span className="grad">stress hydrique</span> avant qu'il ne décide pour vous.</h1>
              <p className="lede">
                AgroSmart AI fusionne imagerie satellite et données climatiques dans un modèle U-Net 2D
                pour cartographier le stress hydrique de la région du Souss-Massa — et orienter chaque
                décision d'irrigation par l'inférence.
              </p>
              <div className="hero-cta">
                <button className="btn btn-mint btn-block" onClick={onLaunch}>
                  {isAuthenticated ? "Accéder au Dashboard" : "Lancer la simulation"}
                  <ArrowRight />
                </button>
                <a className="btn btn-ghost btn-block" href="#model">Voir le modèle</a>
              </div>
              <div className="hero-stats">
                <div className="hstat"><div className="n">92,40 %</div><div className="l">Macro F1-Score</div></div>
                <div className="hstat"><div className="n">U-Net 2D</div><div className="l">Segmentation sémantique</div></div>
                <div className="hstat"><div className="n">5</div><div className="l">Indicateurs fusionnés</div></div>
              </div>
            </div>

            <div className="hero-visual">
              <div className="ph" style={{ background: "none", border: "none", padding: 0 }}>
                <div className="map-canvas">
                  <div className="map-grid" />
                  <div className="map-blob blob-1" />
                  <div className="map-blob blob-2" />
                  <div className="map-blob blob-3" />
                  <div className="map-tag t-high"><span className="d" />Stress élevé</div>
                  <div className="map-tag t-mid"><span className="d" />Modéré</div>
                  <div className="map-tag t-low"><span className="d" />Faible</div>
                  <div className="map-legend">
                    <span>SOUSS-MASSA · CARTE D'INFÉRENCE</span>
                    <span>NDVI · LST · SMI</span>
                  </div>
                </div>
                <div className="float-card">
                  <div className="fc-top">
                    <Droplets style={{ width: 14, height: 14, color: "var(--brand-green)" }} />
                    Indice de stress
                  </div>
                  <div className="fc-val">0,71</div>
                  <div className="fc-sub">+12% vs. saison N-1</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* trust strip */}
        <div className="trust">
          <div className="container trust-inner">
            <span className="chip">Sentinel-2</span>
            <span className="chip">MODIS LST</span>
            <span className="chip">ERA5 Climat</span>
            <span className="chip">U-Net 2D</span>
            <span className="chip">PyTorch</span>
          </div>
        </div>

        {/* ════ 3 · ABOUT ════ */}
        <section id="about">
          <div className="container split">
            <div className="col-img">
              <div className="ph" style={{ padding: 0, overflow: "hidden" }}>
                <img
                  src="/souss-massa-preview.png"
                  alt="Carte d'inférence du stress hydrique — région Souss-Massa"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            </div>
            <div className="col-copy">
              <span className="eyebrow">Le service</span>
              <h2>De la donnée satellite à la décision agronomique.</h2>
              <p>
                AgroSmart AI transforme des couches d'observation complexes en une cartographie claire et
                exploitable du stress hydrique. Là où l'analyse manuelle prend des semaines, le modèle infère
                l'état hydrique d'une parcelle en quelques secondes.
              </p>
              <p>
                Le résultat : des recommandations d'irrigation ciblées, une eau préservée, et des décisions
                appuyées par la donnée plutôt que par l'intuition.
              </p>
              <div className="users">
                <div className="user-row">
                  <div className="user-ic"><Sprout /></div>
                  <div>
                    <div className="ut">Agronomes</div>
                    <div className="us">Diagnostic parcellaire et suivi de campagne en continu.</div>
                  </div>
                </div>
                <div className="user-row">
                  <div className="user-ic"><Droplets /></div>
                  <div>
                    <div className="ut">Gestionnaires des ressources en eau</div>
                    <div className="us">Pilotage de la demande hydrique à l'échelle régionale.</div>
                  </div>
                </div>
                <div className="user-row">
                  <div className="user-ic"><Tractor /></div>
                  <div>
                    <div className="ut">Exploitants & agriculteurs du Souss-Massa</div>
                    <div className="us">Décisions d'irrigation au bon moment, sur la bonne parcelle.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════ 4 · POURQUOI SOUSS-MASSA ════ */}
        <section id="region" className="why">
          <div className="container">
            <div className="sec-head">
              <span className="eyebrow center">Le territoire</span>
              <h2 className="sec-title">Pourquoi le Souss-Massa ?</h2>
              <p className="sec-sub">
                Un des bassins agricoles les plus productifs du Maroc, sous tension hydrique sévère.
                Chaque décision d'irrigation y pèse sur une ressource qui s'épuise.
              </p>
            </div>
            <div className="why-grid">
              <div className="why-card">
                <div className="wc-ic"><Wheat /></div>
                <h4>Région agricole critique</h4>
                <p>Agrumes et primeurs d'exportation : un poids économique majeur, totalement dépendant de l'eau.</p>
              </div>
              <div className="why-card">
                <div className="wc-ic"><TrendingDown /></div>
                <h4>Nappes en baisse</h4>
                <p>Les niveaux des eaux souterraines déclinent d'année en année sous l'effet du pompage.</p>
              </div>
              <div className="why-card">
                <div className="wc-ic"><ThermometerSun /></div>
                <h4>Stress hydrique sévère</h4>
                <p>Sécheresses récurrentes et températures en hausse accentuent la demande en eau des cultures.</p>
              </div>
              <div className="why-card">
                <div className="wc-ic"><Gauge /></div>
                <h4>Optimiser & préserver</h4>
                <p>L'inférence prédictive cible l'irrigation là où elle compte et préserve la ressource.</p>
              </div>
            </div>
            <div className="why-banner">
              <div>
                <div className="wb-t">Une dépendance quasi totale à la ressource en eau</div>
                <div className="wb-s">
                  L'objectif d'AgroSmart AI : anticiper le stress par l'inférence pour optimiser
                  l'irrigation et préserver les nappes du bassin.
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="wb-num">≈ 90%</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--steel)", letterSpacing: "0.5px" }}>
                  DE L'EAU → AGRICULTURE
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════ 5 · LE MODÈLE ET ÉTAPES ════ */}
        <section id="model">
          <div className="container">
            <div className="sec-head">
              <span className="eyebrow center">Architecture & pipeline</span>
              <h2 className="sec-title">Le modèle et les étapes</h2>
              <p className="sec-sub">
                Une topologie U-Net 2D entraînée pour la segmentation sémantique du stress hydrique,
                alimentée par un pipeline de données multi-source.
              </p>
            </div>

            <div className="steps">
              <div className="step-line" />
              <div className="step">
                <div className="step-num">01</div>
                <h4>Collecte & fusion</h4>
                <p>Agrégation des données satellites et climatiques en une pile multi-bandes alignée spatialement.</p>
              </div>
              <div className="step">
                <div className="step-num">02</div>
                <h4>Prétraitement & tiling</h4>
                <p>Nettoyage, normalisation puis découpage en patchs réguliers pour l'entraînement.</p>
              </div>
              <div className="step">
                <div className="step-num">03</div>
                <h4>Entraînement U-Net</h4>
                <p>Apprentissage de la topologie encodeur-décodeur sur les patchs annotés.</p>
              </div>
              <div className="step">
                <div className="step-num">04</div>
                <h4>Inférence & segmentation</h4>
                <p>Segmentation sémantique du stress hydrique et reconstruction de la carte régionale.</p>
              </div>
            </div>

            <div className="model-foot">
              <div className="arch-box">
                <div className="arch-title">
                  <Network />
                  TOPOLOGIE U-NET 2D — encodeur · bottleneck · décodeur
                </div>
                <div className="unet">
                  <span className="bar" style={{ height: "42%" }} />
                  <span className="bar" style={{ height: "62%" }} />
                  <span className="bar" style={{ height: "80%" }} />
                  <span className="bar" style={{ height: "100%" }} />
                  <span className="bar" style={{ height: "100%" }} />
                  <span className="bar" style={{ height: "80%" }} />
                  <span className="bar" style={{ height: "62%" }} />
                  <span className="bar" style={{ height: "42%" }} />
                </div>
              </div>
              <div className="indicators">
                <div className="il">Indicateurs fusionnés en entrée</div>
                <div className="ind-tags">
                  <span className="ind-tag"><span className="dt" />NDVI<span className="mono">végétation</span></span>
                  <span className="ind-tag"><span className="dt" />LST<span className="mono">temp. surface</span></span>
                  <span className="ind-tag"><span className="dt" />Précipitations</span>
                  <span className="ind-tag"><span className="dt" />Humidité du sol</span>
                  <span className="ind-tag"><span className="dt" />Indices de sécheresse</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════ 6 · PERFORMANCES ════ */}
        <section id="perf" className="perf">
          <div className="container">
            <div className="sec-head">
              <span className="eyebrow center">Évaluation</span>
              <h2 className="sec-title">Performances du modèle</h2>
              <p className="sec-sub">
                Mesurées sur le jeu de test de segmentation du stress hydrique du Souss-Massa.
              </p>
            </div>
            <div className="perf-grid">
              <div className="metric">
                <div className="m-label"><Target />Global Accuracy</div>
                <div className="m-val">94,1<span style={{ fontSize: "0.5em" }}>%</span></div>
                <div className="m-sub">Précision globale sur le jeu de test</div>
                <div className="m-bar"><i style={{ width: "94%" }} /></div>
              </div>
              <div className="metric feat">
                <div className="m-label"><Award />Macro F1-Score</div>
                <div className="m-val">92,40<span style={{ fontSize: "0.5em" }}>%</span></div>
                <div className="m-sub">Moyenne équilibrée sur toutes les classes</div>
                <div className="m-bar"><i style={{ width: "92.4%" }} /></div>
              </div>
              <div className="metric">
                <div className="m-label"><Activity />Fonctions de perte</div>
                <div className="m-val">0,084</div>
                <div className="m-sub">Loss finale en convergence</div>
                <div className="m-bar"><i style={{ width: "16%" }} /></div>
              </div>
            </div>
            <div className="loss-row">
              <div className="loss-card">
                <div className="lc-l">Dice Loss<span>chevauchement des masques de segmentation</span></div>
                <div className="lc-v">0,061</div>
              </div>
              <div className="loss-card">
                <div className="lc-l">Cross-Entropy Loss<span>classification pixel par pixel</span></div>
                <div className="lc-v">0,108</div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ════ 7 · FINAL CTA ════ */}
      <section className="final">
        <div className="container">
          <div className="final-box">
            <span className="badge" style={{ marginBottom: 18 }}><Zap />Inférence prête</span>
            <h2>Prêt à lancer la simulation ?</h2>
            <p>
              Accédez au dashboard et générez la carte d'inférence du stress hydrique sur la région
              du Souss-Massa.
            </p>
            <button className="btn btn-mint" onClick={onLaunch}>
              {isAuthenticated ? "Ouvrir le Dashboard" : "Accéder au Dashboard"}
              <ArrowRight />
            </button>
          </div>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer>
        <div className="container foot-inner">
          <div className="foot-brand">
            <AgrosmartLogo variant="icon" iconSize={32} />
            <div className="foot-meta"><b>AgroSmart AI</b> · Prédiction du stress hydrique par U-Net 2D</div>
          </div>
          <div className="foot-right">© 2026 · Projet de Master IA & Science des Données</div>
        </div>
      </footer>

    </div>
  );
}
