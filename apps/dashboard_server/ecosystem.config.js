module.exports = {
	apps: [
		{
			name: "server",
			script: "dist/src/index.js", // 빌드 결과물 실행
			cwd: ".",
			exec_mode: "cluster",
			instances: 1,
			autorestart: true,
			watch: false,
			max_memory_restart: "500M",
			env: {
				NODE_ENV: "production",
			},
		},
	],
};
