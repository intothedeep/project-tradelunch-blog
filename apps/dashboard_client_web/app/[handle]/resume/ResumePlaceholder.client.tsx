export const ResumePlaceHolder = () => {
    return (
        <div className="max-w-[210mm] mx-auto bg-white">
            {/* A4 Aspect Ratio Container */}
            <div className="aspect-[1/1.414] relative border-2 border-muted">
                {/* Placeholder for Resume Image */}
                <div className="absolute inset-0 flex items-center justify-center bg-secondary text-foreground">
                    <div className="text-center p-8">
                        <svg
                            className="w-24 h-24 mx-auto mb-4 text-primary"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line
                                x1="16"
                                y1="13"
                                x2="8"
                                y2="13"
                            ></line>
                            <line
                                x1="16"
                                y1="17"
                                x2="8"
                                y2="17"
                            ></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <p className="text-lg font-mono mb-2">
                            RESUME IMAGE PLACEHOLDER
                        </p>
                        <p className="text-sm">
                            Replace with: &lt;img
                            src=&quot;/resume-image.jpg&quot;
                            alt=&quot;Resume&quot; className=&quot;w-full h-full
                            object-contain&quot; /&gt;
                        </p>
                    </div>
                </div>

                {/* Uncomment to use actual image */}
            </div>
        </div>
    );
};
