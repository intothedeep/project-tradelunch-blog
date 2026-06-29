import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Resume Image Page Component
export const ResumePage = () => {
    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <div className="container mx-auto p-4 md:p-8">
                {/* Header */}
                <Card className="mb-6 bg-card border-primary">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-primary text-2xl">
                                    &gt; RESUME.pdf
                                </CardTitle>
                                <CardDescription className="mt-2">
                                    Taek Lim | Software Engineer
                                </CardDescription>
                            </div>
                            <a
                                href="/resume.pdf"
                                download
                                className="bg-primary text-primary-foreground px-4 py-2 hover:opacity-80 transition-opacity"
                            >
                                DOWNLOAD
                            </a>
                        </div>
                    </CardHeader>
                </Card>

                {/* Resume Image Container */}
                <Card className="bg-card border-primary">
                    <CardContent className="p-4 md:p-8">
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
                                            alt=&quot;Resume&quot;
                                            className=&quot;w-full h-full
                                            object-contain&quot; /&gt;
                                        </p>
                                    </div>
                                </div>

                                {/* Uncomment to use actual image */}
                                {/* <img 
                  src="/resume-image.jpg" 
                  alt="Taek Lim Resume" 
                  className="w-full h-full object-contain"
                /> */}
                            </div>
                        </div>

                        {/* Mobile View Note */}
                        <div className="mt-4 text-center text-sm text-foreground">
                            <p className="mb-2">
                                For best viewing experience, use desktop or
                                download PDF
                            </p>
                            <div className="flex justify-center gap-4">
                                <Badge variant="outline">A4 Size</Badge>
                                <Badge variant="outline">210mm × 297mm</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <Card className="mt-6 bg-card border-primary">
                    <CardContent className="p-4 text-center text-sm">
                        <div className="text-primary mb-2">
                            <span className="animate-pulse">▋</span> DOCUMENT
                            STATUS: READY
                        </div>
                        <div className="text-foreground">
                            Last Updated:{' '}
                            <span suppressHydrationWarning>
                                {new Date().toLocaleDateString()}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
