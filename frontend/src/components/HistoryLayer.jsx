import { Source, Layer } from 'react-map-gl'

export default function HistoryLayer({ places, isActive }) {
  if (!places || places.length === 0) return null

  // Convert places to GeoJSON with visit weight for heatmap intensity
  const geojson = {
    type: 'FeatureCollection',
    features: places.map(place => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [place.lon, place.lat]
      },
      properties: {
        placeId: place.placeId,
        name: place.name,
        visitCount: place.visitCount,
        totalMinutes: place.totalMinutes,
        firstVisit: place.firstVisit,
        lastVisit: place.lastVisit,
        photoUrl: place.photoUrl,
        // Weight for heatmap - logarithmic scale so high-visit places don't dominate
        weight: Math.log2(place.visitCount + 1)
      }
    }))
  }

  // When inactive (Day mode): show as ghostly mist heatmap
  // When active (All-Time mode): show as solid interactive bubbles

  if (!isActive) {
    // Mist/heatmap mode - ethereal, density-based visualization
    return (
      <Source id="history" type="geojson" data={geojson}>
        <Layer
          id="history-mist"
          type="heatmap"
          paint={{
            // Weight based on visit count
            'heatmap-weight': ['get', 'weight'],
            // Intensity increases with zoom
            'heatmap-intensity': [
              'interpolate', ['linear'], ['zoom'],
              10, 0.3,
              15, 1
            ],
            // Purple/violet color ramp for history
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(167, 139, 250, 0)',
              0.1, 'rgba(167, 139, 250, 0.08)',
              0.3, 'rgba(167, 139, 250, 0.15)',
              0.5, 'rgba(196, 181, 253, 0.25)',
              0.7, 'rgba(196, 181, 253, 0.35)',
              1, 'rgba(221, 214, 254, 0.5)'
            ],
            // Radius increases with zoom for smooth mist
            'heatmap-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 20,
              13, 35,
              16, 50
            ],
            // Slight transparency
            'heatmap-opacity': 0.8
          }}
        />
      </Source>
    )
  }

  // Active mode - solid interactive bubbles with clustering
  return (
    <Source
      id="history"
      type="geojson"
      data={geojson}
      cluster={true}
      clusterMaxZoom={16}
      clusterRadius={50}
    >
      {/* Clustered points - solid violet */}
      <Layer
        id="history-clusters"
        type="circle"
        filter={['has', 'point_count']}
        paint={{
          'circle-color': 'rgba(167, 139, 250, 0.85)',
          'circle-radius': [
            'step', ['get', 'point_count'],
            16, 10,
            22, 50,
            28
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(221, 214, 254, 0.9)'
        }}
      />

      {/* Cluster count labels */}
      <Layer
        id="history-cluster-count"
        type="symbol"
        filter={['has', 'point_count']}
        layout={{
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold']
        }}
        paint={{
          'text-color': '#ffffff'
        }}
      />

      {/* Individual points - solid violet */}
      <Layer
        id="history-points"
        type="circle"
        filter={['!', ['has', 'point_count']]}
        paint={{
          'circle-color': 'rgba(167, 139, 250, 0.8)',
          'circle-radius': 9,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(221, 214, 254, 0.9)'
        }}
      />
    </Source>
  )
}
