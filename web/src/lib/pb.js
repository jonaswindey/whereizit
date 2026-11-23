import PocketBase from 'pocketbase'

export const pb = new PocketBase(window.location.origin)
// Several components fetch the same collections concurrently; the SDK would cancel duplicates.
pb.autoCancellation(false)

export const thumbUrl = (record, file) => (file ? pb.files.getURL(record, file, { thumb: '400x400' }) : null)
export const fileUrl = (record, file) => (file ? pb.files.getURL(record, file) : null)
