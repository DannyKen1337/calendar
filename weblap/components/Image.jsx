// A weboldal képei (public/weblapteszt): a next/image átalakítás nélkül, a /weblapteszt előtaggal.
// A külső címeket (hírek képei) változatlanul hagyja.
import NextImage from 'next/image';
import { withBase } from '@/weblap/lib/basePath';

export default function Image({ src, ...props }) {
  return <NextImage src={typeof src === 'string' ? withBase(src) : src} unoptimized {...props} />;
}
