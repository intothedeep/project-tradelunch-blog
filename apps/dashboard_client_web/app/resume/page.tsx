import Image from 'next/image';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollToTopButton } from '@/app/ScrollToTop';

import clsx from 'clsx';
import ResumeTOC from '@/app/resume/ResumeTOC.client';

// Resume Image Page Component
export const ResumePage = () => {
    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <div className="container mx-auto p-4 md:p-8">
                <ResumeTOC />

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
                                className="bg-primary text-primary-foreground px-4 py-2 hover:opacity-80 transition-opacity"
                                href="/resume_taek_lim_052026.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                download={
                                    'Taek_Lim__SOFTWARE_ENGINEER_RESUME.pdf'
                                }
                            >
                                DOWNLOAD RESUME
                            </a>
                        </div>
                    </CardHeader>
                </Card>

                {/* Resume Image Container */}
                <Card className="bg-card border-primary">
                    <CardContent className="p-4 md:p-8">
                        {/* <ResumePlaceHolder /> */}
                        <div
                            className={clsx(
                                'max-w-[210mm] mx-auto bg-white'
                                // 'border border-primary rounded-2xl overflow-hidden'
                            )}
                        >
                            {/* A4 Aspect Ratio Container */}
                            <div className="aspect-[1/1.414] relative border-2 border-muted">
                                {/* <Image
                                    src="/resume_taek_lim_052026.pdf"
                                    alt="Taek Lim Resume"
                                    fill
                                    className="object-contain"
                                /> */}
                                <iframe
                                    src="/resume_taek_lim_1226.pdf"
                                    title="Taek Lim Resume"
                                    className="absolute inset-0"
                                    width="100%"
                                    height="100%"
                                />
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

            <ScrollToTopButton />
        </div>
    );
};

export default ResumePage;
