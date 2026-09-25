# Tokens for developers

Copy this into a Tailwind / NativeWind theme. The same file is `tokens.dev.json`. Colours are CSS variables per theme (`--color-<name>`); apply `data-theme="dark"` (or the class your setup uses) to switch.

```json
{
  "color": {
    "light": {
      "primary": "#0F766E",
      "primary-hover": "#115E59",
      "primary-subtle": "#E6F4F2",
      "on-primary": "#FFFFFF",
      "saffron": "#F4A300",
      "bg": "#FFFFFF",
      "surface": "#F8FAFC",
      "border": "#E2E8F0",
      "border-strong": "#8494A8",
      "text-primary": "#0F172A",
      "text-secondary": "#475569",
      "text-muted": "#5B6B80",
      "auto-field-bg": "#F1F5F9",
      "success": "#166534",
      "success-subtle": "#ECFDF3",
      "on-success": "#FFFFFF",
      "success-on-inverse": "#4ADE80",
      "warning": "#92400E",
      "warning-subtle": "#FFF7E6",
      "danger": "#991B1B",
      "danger-subtle": "#FEF2F2",
      "on-danger": "#FFFFFF",
      "hsd": "#2F4B68",
      "hsd-tint": "#EAF0F6",
      "ms": "#5B3F7A",
      "ms-tint": "#F1ECF6"
    },
    "dark": {
      "primary": "#2DD4BF",
      "primary-hover": "#5EEAD4",
      "primary-subtle": "#0F2E2B",
      "on-primary": "#04201D",
      "saffron": "#F4A300",
      "bg": "#0B1220",
      "surface": "#111A2B",
      "border": "#1F2A3D",
      "border-strong": "#64748B",
      "text-primary": "#F1F5F9",
      "text-secondary": "#CBD5E1",
      "text-muted": "#8A9BB2",
      "auto-field-bg": "#162033",
      "success": "#4ADE80",
      "success-subtle": "#0F2A1B",
      "on-success": "#052E16",
      "success-on-inverse": "#166534",
      "warning": "#FBBF24",
      "warning-subtle": "#2B2110",
      "danger": "#FCA5A5",
      "danger-subtle": "#2A1418",
      "on-danger": "#2A0A0A",
      "hsd": "#93B4D4",
      "hsd-tint": "#16263A",
      "ms": "#C4A8E0",
      "ms-tint": "#251A33"
    }
  },
  "typography": {
    "fontFamily": {
      "sans": [
        "Inter",
        "system-ui",
        "sans-serif"
      ],
      "note": "Enable tabular figures on every numeric Text: fontVariant ['tabular-nums'] (RN) / font-variant-numeric: tabular-nums (web)."
    },
    "scale": {
      "display": {
        "fontSize": "32px",
        "lineHeight": "40px",
        "fontWeight": "600"
      },
      "title": {
        "fontSize": "22px",
        "lineHeight": "28px",
        "fontWeight": "600"
      },
      "heading": {
        "fontSize": "18px",
        "lineHeight": "24px",
        "fontWeight": "600"
      },
      "body": {
        "fontSize": "16px",
        "lineHeight": "24px",
        "fontWeight": "400"
      },
      "label": {
        "fontSize": "14px",
        "lineHeight": "20px",
        "fontWeight": "500"
      },
      "caption": {
        "fontSize": "12px",
        "lineHeight": "16px",
        "fontWeight": "400"
      },
      "number-input": {
        "fontSize": "24px",
        "lineHeight": "32px",
        "fontWeight": "600"
      },
      "number-inline": {
        "fontSize": "16px",
        "lineHeight": "24px",
        "fontWeight": "500"
      }
    }
  },
  "spacing": {
    "4": "4px",
    "8": "8px",
    "12": "12px",
    "16": "16px",
    "20": "20px",
    "24": "24px",
    "32": "32px",
    "40": "40px"
  },
  "radius": {
    "sm": "8px",
    "md": "12px",
    "lg": "16px",
    "full": "9999px"
  },
  "shadow": {
    "sticky": {
      "light": "0 -2px 8px rgba(15,23,42,0.08)",
      "dark": "0 -2px 8px rgba(0,0,0,0.5)"
    },
    "sheet": {
      "light": "0 -4px 16px rgba(15,23,42,0.14)",
      "dark": "0 -4px 16px rgba(0,0,0,0.6)"
    }
  },
  "size": {
    "tap-min": "48px",
    "button-l": "56px",
    "button-m": "44px",
    "input-h": "56px",
    "nozzle-row-h": "64px",
    "icon-inline": "20px",
    "icon-nav": "24px",
    "content-max": "480px",
    "rail-w": "88px"
  },
  "tailwind": {
    "theme": {
      "extend": {
        "colors": {
          "primary": "var(--color-primary)",
          "primary-hover": "var(--color-primary-hover)",
          "primary-subtle": "var(--color-primary-subtle)",
          "on-primary": "var(--color-on-primary)",
          "saffron": "var(--color-saffron)",
          "bg": "var(--color-bg)",
          "surface": "var(--color-surface)",
          "border": "var(--color-border)",
          "border-strong": "var(--color-border-strong)",
          "text-primary": "var(--color-text-primary)",
          "text-secondary": "var(--color-text-secondary)",
          "text-muted": "var(--color-text-muted)",
          "auto-field-bg": "var(--color-auto-field-bg)",
          "success": "var(--color-success)",
          "success-subtle": "var(--color-success-subtle)",
          "on-success": "var(--color-on-success)",
          "success-on-inverse": "var(--color-success-on-inverse)",
          "warning": "var(--color-warning)",
          "warning-subtle": "var(--color-warning-subtle)",
          "danger": "var(--color-danger)",
          "danger-subtle": "var(--color-danger-subtle)",
          "on-danger": "var(--color-on-danger)",
          "hsd": "var(--color-hsd)",
          "hsd-tint": "var(--color-hsd-tint)",
          "ms": "var(--color-ms)",
          "ms-tint": "var(--color-ms-tint)"
        },
        "fontFamily": {
          "sans": [
            "Inter",
            "system-ui",
            "sans-serif"
          ]
        },
        "fontSize": {
          "display": [
            "32px",
            {
              "lineHeight": "40px",
              "fontWeight": "600"
            }
          ],
          "title": [
            "22px",
            {
              "lineHeight": "28px",
              "fontWeight": "600"
            }
          ],
          "heading": [
            "18px",
            {
              "lineHeight": "24px",
              "fontWeight": "600"
            }
          ],
          "body": [
            "16px",
            {
              "lineHeight": "24px",
              "fontWeight": "400"
            }
          ],
          "label": [
            "14px",
            {
              "lineHeight": "20px",
              "fontWeight": "500"
            }
          ],
          "caption": [
            "12px",
            {
              "lineHeight": "16px",
              "fontWeight": "400"
            }
          ],
          "number-input": [
            "24px",
            {
              "lineHeight": "32px",
              "fontWeight": "600"
            }
          ],
          "number-inline": [
            "16px",
            {
              "lineHeight": "24px",
              "fontWeight": "500"
            }
          ]
        },
        "spacing": {
          "4": "4px",
          "8": "8px",
          "12": "12px",
          "16": "16px",
          "20": "20px",
          "24": "24px",
          "32": "32px",
          "40": "40px"
        },
        "borderRadius": {
          "sm": "8px",
          "md": "12px",
          "lg": "16px",
          "full": "9999px"
        },
        "minHeight": {
          "tap": "48px"
        }
      }
    }
  }
}
```
