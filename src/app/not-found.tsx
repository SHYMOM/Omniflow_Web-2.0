import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <h1 className="text-8xl font-bold text-accent-green mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-white mb-2">Page Not Found</h2>
      <p className="text-text-secondary mb-8 text-center max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="bg-white text-black font-semibold px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
