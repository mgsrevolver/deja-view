import { Source, Layer } from 'react-map-gl'

export default function HistoryLayer({ places, isActive }) {
  if (!places || places.length === 0) return null

  // Convert places to GeoJSON
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
        photoUrl: place.photoUrl
      }
    }))
  }

  return (
    <Source
      id="history"
      type="geojson"
      data={geojson}
      cluster={true}
      clusterMaxZoom={16}
      clusterRadius={50}
    >
      {/* Clustered points - violet for history */}
      <Layer
        id="history-clusters"
        type="circle"
        filter={['has', 'point_count']}
        paint={{
          'circle-color': isActive
            ? 'rgba(167, 139, 250, 0.75)'
            : 'rgba(167, 139, 250, 0.3)',
          'circle-radius': [
            'step', ['get', 'point_count'],
            15, 10,
            20, 50,
            25
          ],
          'circle-stroke-width': isActive ? 2 : 1,
          'circle-stroke-color': isActive
            ? 'rgba(196, 181, 253, 0.9)'
            : 'rgba(167, 139, 250, 0.5)'
        }}
      />

      {/* Cluster count labels */}
      <Layer
        id="history-cluster-count"
        type="symbol"
        filter={['has', 'point_count']}
        layout={{
          'text-field': '{point_count_abbreviated}',
          'text-size': 11,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold']
        }}
        paint={{
          'text-color': '#ffffff'
        }}
      />

      {/* Individual points - violet for history */}
      <Layer
        id="history-points"
        type="circle"
        filter={['!', ['has', 'point_count']]}
        paint={{
          'circle-color': isActive
            ? 'rgba(167, 139, 250, 0.7)'
            : 'rgba(167, 139, 250, 0.25)',
          'circle-radius': isActive ? 8 : 5,
          'circle-stroke-width': 1,
          'circle-stroke-color': isActive
            ? 'rgba(196, 181, 253, 0.85)'
            : 'rgba(167, 139, 250, 0.4)'
        }}
      />
    </Source>
  )
}
