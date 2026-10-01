import CattleLoader from './_loader';

// Must be a literal — Next.js parses this statically, so no expressions here.
// cPanel static export only serves prebuilt paths; the real id is read
// client-side via useParams (see _loader/_client).
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '0' }];
}

export default function Page() {
  return <CattleLoader />;
}
