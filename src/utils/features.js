export const PLAN_FEATURES = {
  basic: [
    'catalog',
    'banners',
    'whatsapp',
  ],

  pro: [
    'catalog',
    'banners',
    'whatsapp',
    'stock',
    'sales',
    'financial',
  ],
}

export function hasFeature(store, feature) {
  const plan = store?.plan || 'basic'

  return PLAN_FEATURES[plan]?.includes(feature)
}