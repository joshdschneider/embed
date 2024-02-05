import { useBetaLink } from '@/test/useBetaLink';
// import { Beta } from '@/test/Beta';
import Head from 'next/head';

// const beta = Beta({ host: 'http://localhost:5555' });

export default function Home() {
  const { link } = useBetaLink({
    linkToken: 'tok_b5555e0c36d0a232',
    linkMethod: 'redirect',
    redirectUrl: 'http://localhost:3001',
    host: 'http://localhost:5555',
  });

  async function openLink() {
    try {
      // const res = await link();
      // console.log('RESOLVED', res);
    } catch (err) {
      console.log('ERROR', err);
    }
  }

  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <div>
          <button onClick={openLink}>Link</button>
        </div>
      </main>
    </>
  );
}
