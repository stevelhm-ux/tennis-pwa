export function nanoid(size = 16): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-'
  let id = ''
  for (let i = 0; i < size; i++) id += alphabet[Math.floor(Math.random()*alphabet.length)]
  return id
}
