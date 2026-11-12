import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Badge, Banner, Button, Chip, InlineMessage, Link, Meter, Panel, StatusPill, Toggle } from "../../src/web/src/components/primitives.js";

// Component behavior tests. Colors are verified statically by the
// theme tests (jsdom does not resolve CSS custom properties, so a
// computed-color assertion here would prove nothing); these tests
// prove structure, labels, and interaction.

describe("Button", () => {
  it("renders the primary variant with the pumpkin class and handles clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Run it</Button>);
    const button = screen.getByRole("button", { name: "Run it" });
    expect(button.className).toContain("btn-primary");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders secondary and hero variants, and respects disabled", () => {
    const { rerender } = render(<Button variant="secondary">Back</Button>);
    expect(screen.getByRole("button").className).toContain("btn-secondary");
    rerender(
      <Button disabled variant="hero">
        Reset
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("btn-hero");
    expect(button).toBeDisabled();
  });
});

describe("status indicators", () => {
  it("every Badge variant renders an icon and a text label", () => {
    for (const variant of ["success", "warning", "error", "info"] as const) {
      const { container } = render(<Badge variant={variant}>Label {variant}</Badge>);
      expect(container.querySelector("svg")).not.toBeNull();
      expect(screen.getByText(`Label ${variant}`)).toBeInTheDocument();
    }
  });

  it("every InlineMessage variant renders an icon, a label, and a status role", () => {
    for (const variant of ["success", "warning", "error", "info"] as const) {
      const { container, unmount } = render(<InlineMessage variant={variant}>Note {variant}</InlineMessage>);
      expect(container.querySelector("svg")).not.toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent(`Note ${variant}`);
      unmount();
    }
  });

  it("StatusPill shows ACTIVE by default and FROZEN when frozen", () => {
    const { rerender } = render(<StatusPill frozen={false} />);
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    rerender(<StatusPill frozen />);
    expect(screen.getByText("FROZEN")).toBeInTheDocument();
    expect(screen.queryByText("ACTIVE")).toBeNull();
  });

  it("Banner renders its icon and message with a status role", () => {
    render(<Banner variant="warning">Simulated money only</Banner>);
    expect(screen.getByRole("status")).toHaveTextContent("Simulated money only");
  });
});

describe("Link", () => {
  it("renders an anchor with the theme class", () => {
    render(<Link href="https://example.com">Docs</Link>);
    const link = screen.getByRole("link", { name: "Docs" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link.className).toContain("fg-link");
  });
});

describe("Panel", () => {
  it("renders the title and children in the lavender or sky variant", () => {
    const { rerender } = render(
      <Panel title="Agent" variant="lavender">
        body
      </Panel>,
    );
    expect(screen.getByRole("heading", { name: "Agent" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    rerender(
      <Panel title="Decision" variant="sky">
        body
      </Panel>,
    );
    expect(document.querySelector(".panel-sky")).not.toBeNull();
  });
});

describe("Chip", () => {
  it("renders the label and calls onRemove from a labeled button", () => {
    const onRemove = vi.fn();
    render(<Chip label="acme-corp" onRemove={onRemove} />);
    expect(screen.getByText("acme-corp")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove acme-corp" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("renders no button when not removable", () => {
    render(<Chip label="acme-corp" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Meter", () => {
  it("uses the success fill below 70%, warning at 70-99%, error at 100%", () => {
    const { container, rerender } = render(<Meter label="spent" ratio={0.5} />);
    expect(container.querySelector(".meter-fill-success")).not.toBeNull();
    rerender(<Meter label="spent" ratio={0.7} />);
    expect(container.querySelector(".meter-fill-warning")).not.toBeNull();
    rerender(<Meter label="spent" ratio={1} />);
    expect(container.querySelector(".meter-fill-error")).not.toBeNull();
    expect(container.querySelector(".meter-fill")?.getAttribute("style")).toContain("100%");
  });

  it("always shows the text label next to the bar", () => {
    render(<Meter label="$100 of $1,000 spent" ratio={0.1} />);
    expect(screen.getByText("$100 of $1,000 spent")).toBeInTheDocument();
  });
});

describe("Toggle", () => {
  it("is a keyboard-operable switch that reports its state", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Toggle checked={false} label="Freeze everything" onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Freeze everything" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<Toggle checked label="Freeze everything" onChange={onChange} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("renders a bolt at each end", () => {
    const { container } = render(<Toggle checked={false} label="Freeze" onChange={() => {}} />);
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });
});
