export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6" fill="#142A66" />
      <path d="M5.5 6.5 18.5 17.5" stroke="#7FB0FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M5.5 17.5 18.5 6.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.25" fill="#FFFFFF" stroke="#142A66" strokeWidth="1.25" />
    </svg>
  );
}
