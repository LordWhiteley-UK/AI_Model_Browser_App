import {
  siAlibabadotcom,
  siAlibabacloud,
  siAnthropic,
  siDeepseek,
  siGoogle,
  siHuggingface,
  siMeta,
  siMistralai,
  siNvidia,
  siQwen,
  siSamsung,
} from "simple-icons";

const ICON_MAP: Record<string, typeof siGoogle> = {
  google: siGoogle,
  nvidia: siNvidia,
  meta: siMeta,
  "meta-llama": siMeta,
  mistralai: siMistralai,
  mistral: siMistralai,
  alibaba: siAlibabadotcom,
  alibabacloud: siAlibabacloud,
  qwen: siQwen,
  anthropic: siAnthropic,
  huggingface: siHuggingface,
  "hugging-face": siHuggingface,
  samsung: siSamsung,
  stabilityai: siMeta,
  "stability-ai": siMeta,
  deepseek: siDeepseek,
};

interface ModelAuthorIconProps {
  author: string;
  className?: string;
}

export default function ModelAuthorIcon({ author, className = "" }: ModelAuthorIconProps) {
  const key = author.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const icon = ICON_MAP[key] || ICON_MAP[key.split("-")[0]];

  if (icon) {
    return (
      <svg
        role="img"
        aria-label={icon.title}
        viewBox="0 0 24 24"
        width="16"
        height="16"
        className={`inline-block shrink-0 ${className}`}
        fill={`#${icon.hex}`}
      >
        <title>{icon.title}</title>
        <path d={icon.path} />
      </svg>
    );
  }

  const initial = author.charAt(0).toUpperCase();
  const hue = key.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360;

  return (
    <span
      aria-label={author}
      title={author}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${className}`}
      style={{
        backgroundColor: `hsl(${hue}, 65%, 55%)`,
        color: "#fff",
      }}
    >
      {initial}
    </span>
  );
}
