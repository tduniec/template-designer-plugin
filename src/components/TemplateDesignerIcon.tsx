import SvgIcon, { SvgIconProps } from "@material-ui/core/SvgIcon";

export const TemplateDesignerIcon = (props: SvgIconProps) => (
  <SvgIcon
    {...props}
    viewBox="0 0 96 96"
    stroke="currentColor"
    fill="none"
    strokeWidth={3.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x={6} y={6} width={84} height={84} rx={22} />
    <polygon points="28,18 42,32 28,46 14,32" />
    <rect x={58} y={24} width={24} height={16} rx={3} />
    <rect x={16} y={60} width={24} height={16} rx={3} />
    <rect x={58} y={60} width={24} height={16} rx={3} />
    <path d="M42 32 H58" />
    <path d="M58 32 l-4 -3.5 M58 32 l-4 3.5" />
    <path d="M28 46 V60" />
    <path d="M28 60 l-4 -4 M28 60 l4 -4" />
    <path d="M40 68 H58" />
    <path d="M58 68 l-4 -3.5 M58 68 l-4 3.5" />
    <path d="M70 40 V60" />
    <path d="M70 60 l-4 -4 M70 60 l4 -4" />
  </SvgIcon>
);

export default TemplateDesignerIcon;
