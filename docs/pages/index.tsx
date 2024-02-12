import Head from 'next/head';
import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);

  // const { link } = useKitLink({
  //   linkToken: 'tok_e902067c61e6882d',
  //   linkMethod: 'redirect',
  //   redirectUrl: 'http://localhost:3001',
  //   host: 'http://localhost:5555',
  // });

  async function openLink() {
    try {
      setLoading(true);
      // const res = await link();
      // console.log('RESOLVED', res);
    } catch (err) {
      console.log('ERROR', err);
    } finally {
      setLoading(false);
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
          <button onClick={openLink} disabled={loading}>
            Link
          </button>
        </div>
      </main>
    </>
  );
}
