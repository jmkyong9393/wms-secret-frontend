import React, { useState, useRef, useEffect } from 'react';

interface BBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  ymin?: number;
  xmin?: number;
  ymax?: number;
  xmax?: number;
  label?: string;
  color?: string;
}

interface BBoxImageRendererProps {
  src: string;
  bboxes: BBox[];
  alt?: string;
}

export function BBoxImageRenderer({ src, bboxes, alt = '검수 사진' }: BBoxImageRendererProps) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // When image loads, get its natural dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImageSize({
      width: e.currentTarget.naturalWidth,
      height: e.currentTarget.naturalHeight
    });
    updateDisplaySize();
  };

  const updateDisplaySize = () => {
    if (containerRef.current) {
      setDisplaySize({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }
  };

  useEffect(() => {
    window.addEventListener('resize', updateDisplaySize);
    // Initial size check
    setTimeout(updateDisplaySize, 100);
    return () => window.removeEventListener('resize', updateDisplaySize);
  }, [src]);

  // Since object-fit is contain, we need to find the actual rendered image dimensions
  // and the letterbox offset to correctly position absolute boxes.
  let renderedWidth = displaySize.width;
  let renderedHeight = displaySize.height;
  let offsetX = 0;
  let offsetY = 0;

  if (imageSize.width > 0 && imageSize.height > 0) {
    const imageAspect = imageSize.width / imageSize.height;
    const containerAspect = displaySize.width > 0 && displaySize.height > 0 
      ? displaySize.width / displaySize.height 
      : imageAspect;

    if (imageAspect > containerAspect) {
      // Image is wider than container - letterbox top and bottom
      renderedWidth = displaySize.width;
      renderedHeight = displaySize.width / imageAspect;
      offsetY = (displaySize.height - renderedHeight) / 2;
    } else {
      // Image is taller than container - pillarbox sides
      renderedHeight = displaySize.height;
      renderedWidth = displaySize.height * imageAspect;
      offsetX = (displaySize.width - renderedWidth) / 2;
    }
  }

  const effectiveScale = imageSize.width > 0 ? renderedWidth / imageSize.width : 1;

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full min-h-[300px] bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- 서명 URL·외부 CDN·blob 원본은 next/image 서버 최적화를 태울 수 없다
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          onLoad={handleImageLoad}
        />
      ) : (
        <div className="text-gray-400 font-medium">이미지를 불러올 수 없습니다.</div>
      )}
      
      {/* BBox Overlays */}
      {imageSize.width > 0 && bboxes && bboxes.map((bbox, idx) => {
        // Transform coordinates assuming they are either percentages (0~100) or 0~1000 scale
        let bx = bbox.x || 0;
        let by = bbox.y || 0;
        let bw = bbox.width || 0;
        let bh = bbox.height || 0;
        
        if (bbox.xmin !== undefined && bbox.ymin !== undefined && bbox.xmax !== undefined && bbox.ymax !== undefined) {
          bx = bbox.xmin / 10;
          by = bbox.ymin / 10;
          bw = (bbox.xmax - bbox.xmin) / 10;
          bh = (bbox.ymax - bbox.ymin) / 10;
        }

        const top = offsetY + ((by / 100) * imageSize.height * effectiveScale);
        const left = offsetX + ((bx / 100) * imageSize.width * effectiveScale);
        const boxWidth = (bw / 100) * imageSize.width * effectiveScale;
        const boxHeight = (bh / 100) * imageSize.height * effectiveScale;
        
        return (
          <div
            key={idx}
            className="absolute border-2 z-10 group cursor-help transition-all hover:bg-white/10"
            style={{
              top: `${top}px`,
              left: `${left}px`,
              width: `${boxWidth}px`,
              height: `${boxHeight}px`,
              borderColor: bbox.color || 'red'
            }}
          >
            {/* Tooltip / Label */}
            {bbox.label && (
              <div className="absolute -top-7 left-0 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity">
                {bbox.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
