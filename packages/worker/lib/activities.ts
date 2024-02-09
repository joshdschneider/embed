export async function lottery({ guess }: { guess: number }): Promise<boolean> {
  console.log('Playing lottery with guess', guess);
  const winningNumber = Math.floor(Math.random() * 1000);
  console.log('Winning number is', winningNumber);
  return guess === winningNumber;
}
