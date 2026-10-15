// Shared ReactMarkdown component overrides. Opens all links in a new tab with
// safe rel attributes so external news/source links never hijack the SPA tab.

export const MD_COMPONENTS = {
  a: ({ node, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" />
  )
}
