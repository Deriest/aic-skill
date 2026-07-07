import React from 'react';

export function WorkspaceScene() {
  return (
    <svg
      viewBox="0 0 400 96"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: 'pixelated', display: 'block', verticalAlign: 'middle' }}
    >
          {/* Room Background / Walls & Floor */}
          <g id="background" shapeRendering="crispEdges">
            {/* Dark background already handled by container but let's draw walls */}
            <rect x="0" y="0" width="400" height="72" fill="#0d0d1e" />
            {/* Floor */}
            <rect x="0" y="72" width="400" height="24" fill="#14142b" />
            {/* Floor board lines */}
            <rect x="0" y="72" width="400" height="1" fill="#1b1b3a" />
            <rect x="0" y="80" width="400" height="1" fill="#1b1b3a" />
            <rect x="0" y="88" width="400" height="1" fill="#1b1b3a" />
          </g>

          {/* Window showing pixel star night or cyber sky */}
          <g id="window" shapeRendering="crispEdges">
            {/* Window Frame */}
            <rect x="10" y="8" width="40" height="32" fill="#1f1f3a" />
            <rect x="11" y="9" width="38" height="30" fill="#050510" />
            {/* Cyber City Moon / Cyber glow in sky */}
            <rect x="38" y="12" width="6" height="6" fill="#00d4ff" fillOpacity="0.8" />
            <rect x="40" y="14" width="2" height="2" fill="#ffffff" />
            {/* Stars */}
            <rect x="16" y="15" width="1" height="1" fill="#ffffff" />
            <rect x="26" y="24" width="1" height="1" fill="#ffffff" fillOpacity="0.7" />
            <rect x="20" y="28" width="1" height="1" fill="#ffffff" fillOpacity="0.5" />
            <rect x="34" y="18" width="1" height="1" fill="#ffffff" />
            {/* Grid/Neon grid outside window representing digital cityscape */}
            <rect x="11" y="32" width="38" height="1" fill="#7c3aed" fillOpacity="0.4" />
            <rect x="18" y="28" width="4" height="11" fill="#ff4444" fillOpacity="0.2" />
            <rect x="28" y="22" width="6" height="17" fill="#ffcc00" fillOpacity="0.2" />
          </g>

          {/* Server Rack / System Board (Glowy computer servers on the side) */}
          <g id="server-rack" shapeRendering="crispEdges">
            <rect x="360" y="20" width="24" height="52" fill="#20203a" />
            <rect x="361" y="21" width="22" height="50" fill="#101020" />
            {/* Server unit 1 */}
            <rect x="363" y="24" width="18" height="6" fill="#1a1a2e" />
            <rect x="365" y="26" width="2" height="2" fill="#00ff88" className="animate-pulse" />
            <rect x="370" y="26" width="4" height="2" fill="#444466" />
            {/* Server unit 2 */}
            <rect x="363" y="34" width="18" height="6" fill="#1a1a2e" />
            <rect x="365" y="36" width="2" height="2" fill="#ff4444" />
            <rect x="370" y="36" width="4" height="2" fill="#444466" />
            {/* Server unit 3 */}
            <rect x="363" y="44" width="18" height="6" fill="#1a1a2e" />
            <rect x="365" y="46" width="2" height="2" fill="#00d4ff" className="animate-pulse" />
            <rect x="370" y="46" width="4" height="2" fill="#00d4ff" fillOpacity="0.4" />
            {/* Server unit 4 */}
            <rect x="363" y="54" width="18" height="6" fill="#1a1a2e" />
            <rect x="365" y="56" width="2" height="2" fill="#ffcc00" />
            <rect x="370" y="56" width="4" height="2" fill="#444466" />
            {/* Cables hanging */}
            <path d="M 362 30 Q 358 45 362 60" stroke="#7c3aed" strokeWidth="1" fill="none" />
            <path d="M 363 40 Q 357 50 363 58" stroke="#00d4ff" strokeWidth="1" fill="none" />
          </g>

          {/* Desk with computer & equipment */}
          <g id="desk" shapeRendering="crispEdges">
            {/* Desk Surface */}
            <rect x="120" y="60" width="150" height="4" fill="#3c2415" />
            <rect x="120" y="64" width="150" height="2" fill="#27140a" />
            {/* Desk Legs */}
            <rect x="124" y="66" width="4" height="18" fill="#1e1e1e" />
            <rect x="262" y="66" width="4" height="18" fill="#1e1e1e" />
            {/* Keyboard */}
            <rect x="190" y="58" width="16" height="2" fill="#d1d5db" />
            <rect x="207" y="59" width="3" height="1" fill="#00d4ff" /> {/* Mouse */}
          </g>

          {/* Computer / Main Monitor */}
          <g id="computer" shapeRendering="crispEdges">
            {/* Stand */}
            <rect x="196" y="52" width="4" height="8" fill="#4b5563" />
            <rect x="192" y="59" width="12" height="1" fill="#374151" />
            {/* Monitor Outer Frame */}
            <rect x="180" y="32" width="36" height="21" fill="#374151" />
            <rect x="181" y="33" width="34" height="19" fill="#1f2937" />
            {/* Screen Content - Glowing Terminal / Code */}
            <rect x="182" y="34" width="32" height="17" fill="#050a15" />
            {/* Pixel code lines (green/cyan) */}
            <rect x="184" y="36" width="12" height="2" fill="#00ff88" fillOpacity="0.8" />
            <rect x="184" y="39" width="18" height="2" fill="#00d4ff" fillOpacity="0.7" />
            <rect x="184" y="42" width="8" height="2" fill="#ffcc00" fillOpacity="0.8" />
            <rect x="184" y="45" width="22" height="2" fill="#00ff88" fillOpacity="0.9" />
            <rect x="184" y="48" width="14" height="2" fill="#ffffff" fillOpacity="0.5" />
            {/* Tiny code cursor */}
            <rect x="199" y="48" width="2" height="2" fill="#00ff88" className="animate-ping" />
          </g>

          {/* System Board / Circuit Diagram on Wall */}
          <g id="system-board" shapeRendering="crispEdges">
            <rect x="270" y="10" width="20" height="16" fill="#162e1a" />
            <rect x="271" y="11" width="18" height="14" fill="#0d1f11" />
            {/* Tracks & Chips */}
            <rect x="274" y="14" width="4" height="4" fill="#2a4d33" />
            <rect x="275" y="15" width="2" height="2" fill="#00ff88" />
            <line x1="278" y1="16" x2="284" y2="16" stroke="#4e805b" strokeWidth="1" />
            <line x1="284" y1="16" x2="284" y2="20" stroke="#4e805b" strokeWidth="1" />
            <rect x="282" y="20" width="4" height="3" fill="#8b5cf6" />
          </g>

          {/* House Plants (A pixel-art plant in a pot on the desk) */}
          <g id="plants" shapeRendering="crispEdges">
            {/* Pot */}
            <rect x="130" y="52" width="6" height="8" fill="#d97706" />
            <rect x="129" y="52" width="8" height="2" fill="#b45309" />
            {/* Leaves */}
            <rect x="128" y="48" width="4" height="4" fill="#047857" />
            <rect x="133" y="46" width="4" height="6" fill="#065f46" />
            <rect x="131" y="43" width="3" height="5" fill="#059669" />
            <rect x="136" y="49" width="3" height="3" fill="#047857" />
          </g>

          {/* Sleeping Cat on desk */}
          <g id="cat" shapeRendering="crispEdges">
            {/* Cat body (orange) */}
            <rect x="240" y="54" width="10" height="6" fill="#f97316" rx="2" />
            <rect x="248" y="52" width="4" height="4" fill="#ea580c" /> {/* Head */}
            <rect x="248" y="50" width="1" height="2" fill="#f97316" /> {/* Ear 1 */}
            <rect x="251" y="50" width="1" height="2" fill="#f97316" /> {/* Ear 2 */}
            <rect x="242" y="52" width="4" height="2" fill="#ea580c" /> {/* Tail */}
            <rect x="249" y="54" width="2" height="1" fill="#fee2e2" /> {/* Closed eyes/snout */}
          </g>
        </svg>
  );
}
