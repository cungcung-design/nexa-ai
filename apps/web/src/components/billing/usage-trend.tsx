"use client";

import { useEffect, useRef, useState } from "react";
import type { BillingUsagePoint } from "@/lib/api";

/**
 * Daily usage trend of the workspace.
 *
 * The chart keeps the geometry of the approved design: the same view box,
 * the same grid, the same line and point styling.
 */
export function UsageTrend({ trend }: { trend: BillingUsagePoint[] }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    left: number;
    top: number;
    text: string;
  } | null>(null);

  const points = trend.length ? trend : [];
  const maxValue = Math.max(
    1,
    ...points.map((point) => point.value)
  );
  const top = niceCeil(maxValue);

  const left = 47;
  const right = 730;
  const topY = 10;
  const bottomY = 378;
  const step =
    points.length > 1 ? (right - 58) / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => ({
    ...point,
    cx: points.length > 1 ? 58 + index * step : 58 + (right - 58) / 2,
    cy:
      bottomY - (point.value / maxValue) * (bottomY - topY),
  }));

  const path = coordinates
    .map((point, index) =>
      index === 0 ? `M${point.cx} ${point.cy}` : `L${point.cx} ${point.cy}`
    )
    .join(" ");

  const labels = [0, 1, 2, 3, 4].map((index) =>
    top * (1 - index / 4)
  );

  useEffect(() => {
    function hide() {
      setTooltip(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hide();
    }
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) hide();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", hide);
    };
  }, []);

  function show(point: (typeof coordinates)[number]) {
    const container = wrapperRef.current;
    const element = document.getElementById(`usage-point-${point.day}`);
    if (!container || !element) return;
    const containerBounds = container.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    const tooltipElement = document.getElementById("usage-tooltip");
    if (!tooltipElement) return;
    const tooltipWidth = tooltipElement.offsetWidth;
    const tooltipHeight = tooltipElement.offsetHeight;
    let tooltipLeft =
      bounds.left - containerBounds.left +
      bounds.width / 2 -
      tooltipWidth / 2;
    tooltipLeft = Math.max(
      4,
      Math.min(tooltipLeft, containerBounds.width - tooltipWidth - 4)
    );
    const tooltipTop = Math.max(
      4,
      bounds.top - containerBounds.top - tooltipHeight - 10
    );
    setTooltip({
      left: tooltipLeft,
      top: tooltipTop,
      text: `${formatDay(point.day)} · ${point.value.toLocaleString("en-US")}`,
    });
  }

  return (
    <div className="chart-wrap relative mt-4" ref={wrapperRef}>
      <svg
        className="billing-chart block w-full h-auto"
        viewBox="0 0 744 410"
        role="group"
        aria-labelledby="billing-chart-title billing-chart-description"
      >
        <title id="billing-chart-title">
          Daily usage of the current billing period
        </title>
        <desc id="billing-chart-description">
          Daily metered requests. Focus a point to view its value.
        </desc>

        <g className="billing-grid">
          {[10, 102, 194, 286, 378].map((y) => (
            <line key={y} x1={left} y1={y} x2={right} y2={y} />
          ))}
        </g>

        <g textAnchor="end">
          {labels.map((value, index) => (
            <text key={index} x={37} y={18 + index * 92}>
              {formatAxisValue(value)}
            </text>
          ))}
        </g>

        {coordinates.length ? (
          <path className="billing-trend-line" d={path} />
        ) : null}

        <g id="points">
          {coordinates.map((point) => (
            <circle
              key={point.day}
              id={`usage-point-${point.day}`}
              className="billing-trend-point"
              cx={point.cx}
              cy={point.cy}
              r={4}
              tabIndex={0}
              role="img"
              aria-label={`${formatDay(point.day)}: ${point.value}`}
              onPointerEnter={() => show(point)}
              onPointerLeave={() => setTooltip(null)}
              onFocus={() => show(point)}
              onBlur={() => setTooltip(null)}
              onClick={() => show(point)}
            />
          ))}
        </g>

        <g textAnchor="middle">
          {coordinates.map((point) => (
            <text key={point.day} x={point.cx} y={397}>
              {formatDay(point.day)}
            </text>
          ))}
        </g>
      </svg>

      <div
        className="billing-tooltip"
        id="usage-tooltip"
        role="tooltip"
        style={
          tooltip
            ? { left: `${tooltip.left}px`, top: `${tooltip.top}px` }
            : undefined
        }
        hidden={!tooltip}
      >
        {tooltip?.text ?? ""}
      </div>
    </div>
  );
}

function niceCeil(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatAxisValue(value: number) {
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
  }
  return String(Math.round(value));
}

function formatDay(day: string) {
  const time = Date.parse(day);
  if (Number.isNaN(time)) return day;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(time);
}
