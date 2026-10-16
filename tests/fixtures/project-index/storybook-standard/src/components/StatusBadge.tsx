export function StatusBadge(props: { tone?: 'success' | 'warning'; children: string }) {
  return <span data-tone={props.tone ?? 'success'}>{props.children}</span>;
}
