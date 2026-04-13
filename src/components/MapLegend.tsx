"use client";

import { MAP_COLORS } from "@/lib/constants";

interface MapLegendProps {
  showDetailLayers: boolean;
}

export default function MapLegend({ showDetailLayers }: MapLegendProps) {
  return (
    <div className="absolute bottom-4 left-4 pointer-events-none" style={{ zIndex: 1000 }}>
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3.5 py-3 space-y-2.5">
        <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-widest">
          Map Legend
        </p>

        {/* Boundary types */}
        <div className="space-y-1.5">
          {/* State */}
          <div className="flex items-center gap-2.5">
            <svg width="20" height="2" className="flex-shrink-0">
              <line x1="0" y1="1" x2="20" y2="1" stroke={MAP_COLORS.active} strokeWidth="1.5" />
            </svg>
            <span className="text-slate-400 text-xs">State boundary</span>
          </div>

          {/* County — only show when zoomed in */}
          {showDetailLayers && (
            <div className="flex items-center gap-2.5">
              <svg width="20" height="2" className="flex-shrink-0">
                <line x1="0" y1="1" x2="20" y2="1" stroke={MAP_COLORS.active} strokeWidth="1" />
              </svg>
              <span className="text-slate-400 text-xs">County boundary</span>
            </div>
          )}

          {/* District — only show when zoomed in */}
          {showDetailLayers && (
            <div className="flex items-center gap-2.5">
              <svg width="20" height="2" className="flex-shrink-0">
                <line x1="0" y1="1" x2="20" y2="1" stroke={MAP_COLORS.active} strokeWidth="1" strokeDasharray="4 3" />
              </svg>
              <span className="text-slate-400 text-xs">Congressional district</span>
            </div>
          )}
        </div>

        {/* Highlight states */}
        <div className="space-y-1.5 pt-0.5 border-t border-slate-700/50">
          {/* Has elections */}
          <div className="flex items-center gap-2.5">
            <span
              className="w-4 h-3 rounded-sm flex-shrink-0 border"
              style={{
                backgroundColor: MAP_COLORS.activeFill,
                borderColor: MAP_COLORS.active,
                opacity: 0.8,
              }}
            />
            <span className="text-slate-400 text-xs">Has elections</span>
          </div>

          {/* Highlighted */}
          <div className="flex items-center gap-2.5">
            <span
              className="w-4 h-3 rounded-sm flex-shrink-0 border"
              style={{
                backgroundColor: MAP_COLORS.hoverFill,
                borderColor: MAP_COLORS.hover,
              }}
            />
            <span className="text-slate-400 text-xs">Selected region</span>
          </div>
        </div>

        {/* Zoom hint */}
        {!showDetailLayers && (
          <p className="text-[10px] text-slate-600 pt-0.5 border-t border-slate-700/50">
            Scroll to zoom in for counties &amp; districts
          </p>
        )}
      </div>
    </div>
  );
}
