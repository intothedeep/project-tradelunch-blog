import type { NextConfig } from 'next';
import path from 'path';

type WebpackFn = NonNullable<NextConfig['webpack']>;
type WebpackConfig = Parameters<WebpackFn>[0];

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    webpack: (config: WebpackConfig) => {
        console.log('>> next.config.ts::webpack config called');

        // PDF loader
        config.module.rules.push({
            test: /\.(pdf)$/,
            type: 'asset/resource',
        });

        // SVG loader
        // config.module.rules.push({
        // 	test: /\.svg$/,
        // 	use: [
        // 		{
        // 			loader: "@svgr/webpack",
        // 			options: {
        // 				svgoConfig: {
        // 					plugins: [
        // 						{
        // 							name: "preset-default",
        // 							params: {
        // 								overrides: {
        // 									removeViewBox: false,
        // 								},
        // 							},
        // 						},
        // 					],
        // 				},
        // 			},
        // 		},
        // 	],
        // });

        // alias for path
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': path.resolve(__dirname, '.'),
            '@/components': path.resolve(__dirname, 'components'),
            '@/hooks': path.resolve(__dirname, 'hooks'),
            '@/styles': path.resolve(__dirname, 'styles'),
            '@/types': path.resolve(__dirname, 'types'),
            '@/lib': path.resolve(__dirname, 'lib'),
            '@/utils': path.resolve(__dirname, 'utils'),
        };

        return config;
    },
};

export default nextConfig;
