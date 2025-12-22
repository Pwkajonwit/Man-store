export function getImageUrl(obj: any): string | null {
    if (!obj) return null;
    const keys = ['imageUrl', 'vehicleImageUrl', 'vehicleImage', 'image', 'image_url', 'photoURL', 'photoUrl', 'url', 'imageUrlSmall', 'image_url_small'];
    for (const k of keys) {
        const v = obj[k];
        if (v && typeof v === 'string' && v.trim()) return v;
    }
    return null;
}
