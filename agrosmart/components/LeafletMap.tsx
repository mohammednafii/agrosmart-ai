
"use client";

/**
 * LeafletMap.tsx — Visualisation Hybride Google Maps (Frontière globale unique).
 * * Filtre les entités du GeoJSON pour n'afficher que le contour général de la région 
 * Souss-Massa ("souss"), éliminant ainsi les découpages internes des provinces.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  ImageOverlay,
  useMap,
} from "react-leaflet";
import type { PathOptions } from "leaflet";

export interface PredictionResult {
  success: boolean;
  image: string; // PNG Base64
  bounds: [[number, number], [number, number]];
  region: string;
  date: string;
  class_distribution?: Record<string, number>;
}

export interface MapPanelProps {
  prediction: PredictionResult | null;
}

const GLOBAL_SM_BOUNDS: [[number, number], [number, number]] = [
  [28.90, -10.30], // Sud-Ouest
  [31.15, -5.20],  // Nord-Est
];

function MapController({
  predictionBounds,
}: {
  predictionBounds: [[number, number], [number, number]] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!predictionBounds) return;
    map.fitBounds(predictionBounds, { padding: [30, 30] });
  }, [predictionBounds, map]);

  return null;
}

export default function MapPanel({ prediction }: MapPanelProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoJsonData, setGeoJsonData] = useState<any>(null);

  useEffect(() => {
    fetch("/souss_massa.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`GeoJSON HTTP ${res.status}`);
        return res.json();
      })
      .then(setGeoJsonData)
      .catch((err) => console.error("[AgroSmart] GeoJSON load error:", err));
  }, []);

  /**
   * Style appliqué uniquement à la frontière générale extérieure.
   */
  const getGlobalStyle = useCallback((): PathOptions => ({
    fillOpacity: 0,
    color: "#00c896",              // Couleur vert émeraude AgroSmart
    weight: 3,                     // Ligne légèrement épaissie pour délimiter nettement la zone d'étude
    dashArray: "8, 8",             // Style pointillé dynamique
  }), []);

  /**
   * 💡 LE FILTRE CRITIQUE :
   * Parcourt le GeoJSON et n'accepte QUE l'élément dont le nom est "souss".
   * Supprime automatiquement toutes les lignes internes des provinces du milieu.
   */
  const filterOnlyGlobalSouss = useCallback((feature: any) => {
    return feature?.properties?.name === "souss";
  }, []);

  return (
    <MapContainer
      bounds={GLOBAL_SM_BOUNDS}
      boundsOptions={{ padding: [20, 20] }}
      style={{ width: "100%", height: "100%" }}
      zoomControl={true}
    >
      {/* ── FOND DE CARTE : GOOGLE MAPS HYBRIDE (Quartiers, Routes et Villes visibles) ── */}
      <TileLayer
        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        attribution='© <a href="https://maps.google.com">Google Maps</a>'
        maxZoom={20}
        zIndex={1}
      />

      {/* ── COUCHE DE PRÉDICTION U-NET (Transparence optimisée) ── */}
      {prediction && (
        <ImageOverlay
          url={`data:image/png;base64,${prediction.image}`}
          bounds={prediction.bounds}
          opacity={0.45} // Laisse passer les détails des rues et parcelles en dessous
          interactive={false}
          zIndex={10}
        />
      )}

      {/* ── CONTOUR GÉOJSON SÉLECTIF (Frontière générale uniquement) ── */}
      {geoJsonData && (
        <GeoJSON
          key={JSON.stringify(geoJsonData)} // Force le re-render si le fichier change
          data={geoJsonData}
          style={getGlobalStyle}
          filter={filterOnlyGlobalSouss}  // 👈 Application du filtre d'exclusion
        />
      )}

      <MapController predictionBounds={prediction ? prediction.bounds : null} />
    </MapContainer>
  );
}