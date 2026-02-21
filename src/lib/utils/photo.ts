/** crypto.randomUUID fallback for older iOS Safari / non-HTTPS */
function uuid(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
		(+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
	);
}

export async function resizePhoto(
	file: File,
	maxEdge = 1200,
	quality = 0.8
): Promise<{ id: string; blob: Blob }> {
	const url = URL.createObjectURL(file);
	try {
		const img = await loadImage(url);
		const { width, height } = img;

		let w = width;
		let h = height;
		if (w > maxEdge || h > maxEdge) {
			const scale = maxEdge / Math.max(w, h);
			w = Math.round(w * scale);
			h = Math.round(h * scale);
		}

		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(img, 0, 0, w, h);

		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
				'image/jpeg',
				quality
			);
		});

		return { id: uuid(), blob };
	} finally {
		URL.revokeObjectURL(url);
	}
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Failed to load image'));
		img.src = src;
	});
}
