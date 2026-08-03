import Image from 'next/image';

export function PageHero({ eyebrow, title, description, image }: { eyebrow: string; title: string; description: string; image: string }) {
  return (
    <section className="relative isolate min-h-[430px] overflow-hidden bg-[#061a37] text-white">
      <Image src={image} alt="" fill priority sizes="100vw" className="object-cover opacity-55" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#061a37] via-[#061a37]/80 to-transparent" />
      <div className="marketing-shell relative flex min-h-[430px] items-end py-16">
        <div className="max-w-3xl marketing-reveal">
          <p className="marketing-eyebrow text-[#9bbcff]">{eyebrow}</p>
          <h1 className="mt-4 text-5xl font-black leading-[.95] tracking-[-.045em] sm:text-6xl lg:text-7xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">{description}</p>
        </div>
      </div>
    </section>
  );
}
