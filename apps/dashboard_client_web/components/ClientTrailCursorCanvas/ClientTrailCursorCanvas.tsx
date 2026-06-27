import React from 'react';

import './ClientTrailCursorCanvas.scss';

type Props = Record<string, never>;

export const ClientTrailCursorCanvas: React.FC<Props> = () => {
    return (
        <canvas
            hidden
            id="cursor-trail-canvas"
        ></canvas>
    );
};

export default ClientTrailCursorCanvas;
