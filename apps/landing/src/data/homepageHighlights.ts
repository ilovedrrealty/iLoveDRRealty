const PHOTO_BASE = 'https://pznmfxejanwxtsopxxrp.supabase.co/storage/v1/object/public/listing-images/83b375a7-55f4-413c-ab99-bc2622f8c260/'

export const homepagePhoto = (filename: string) => `${PHOTO_BASE}${filename}`

// These published properties supplied the photos in the approved homepage design.
// The gallery fetches their current details and only displays active listings.
export const HOMEPAGE_PROPERTIES = [
  { id: '84bf8fdb-90ff-4886-99e5-d919b05d7f48', photo: '35ecdc8a-7db5-4715-9d40-82408a9a0b09.jpg' },
  { id: '71b76839-67e0-4f75-a94c-9657898969b6', photo: 'fa194f24-58e9-496e-a6f6-20173e78318a.jpg' },
  { id: '5412a437-f51e-4c62-b44b-dd2dca11f7f0', photo: '67ba5ca8-11e7-4d42-85f2-beafe36d4e9b.jpg' },
  { id: 'a0974a34-adf7-4d47-b2d5-ab2331987e47', photo: 'a45aeb4d-7e67-4b2a-88b3-889920e48844.jpg' },
  { id: '5b0b98ac-534d-4482-8d67-f42bcb20acbb', photo: '7cc7ba5a-19ae-4c50-a167-2c825efea880.jpg' },
] as const

export const HOMEPAGE_CATEGORIES = [
  { key: 'new', query: '', photo: HOMEPAGE_PROPERTIES[1].photo },
  { key: 'rent', query: '?purpose=rent', photo: HOMEPAGE_PROPERTIES[3].photo },
  { key: 'villa', query: '?type=Villa', photo: HOMEPAGE_PROPERTIES[0].photo },
  { key: 'apartment', query: '?type=Apartment', photo: HOMEPAGE_PROPERTIES[2].photo },
  { key: 'condo', query: '?type=Condo', photo: '883f7652-2a5e-4e11-bb55-8b18ddf7400e.jpg' },
  { key: 'land', query: '?type=Land', photo: '792e3d26-c9c9-4c92-8dc0-e475ed7617ad.jpg' },
  { key: 'commercial', query: '?type=Commercial', photo: 'dfccb789-95cd-49d1-ae15-cc3353f4f210.jpg' },
  { key: 'punta-cana', query: '?location=Punta%20Cana', photo: HOMEPAGE_PROPERTIES[4].photo },
  { key: 'sosua', query: '?location=Sos%C3%BAa', photo: HOMEPAGE_PROPERTIES[1].photo },
] as const
