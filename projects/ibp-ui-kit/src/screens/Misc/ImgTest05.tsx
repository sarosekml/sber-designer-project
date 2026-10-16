import React from 'react';

export function ImgTest05() {
  return (
    <main
      data-sd-screen-root="true"
      aria-label={"img test 05"}
      style={{ minHeight: '100vh', background: '#ffffff', color: '#111827' }}
    >
      <section
        data-sd-empty-canvas="true"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 48,
        }}
      >
        <div
          style={{
            width: 'min(100%, 960px)',
            minHeight: 520,
            border: '1px dashed #d1d5db',
            borderRadius: 16,
            background: '#ffffff',
          }}
        />
      </section>
    </main>
  );
}
