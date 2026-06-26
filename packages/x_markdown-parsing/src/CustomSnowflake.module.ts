/**
 * @description 
 *      [ 1bit sign | 41bit timestamp | 10bit machine ID | 12bit sequence ]
 * 
 *      637491971203534849
 *      EPOCH = 1609459200000n; // 2021-01-01T00:00:00Z
 *      machineId = 1n;
 * 
 * 필드 값 의미
 * timestamp 약 2025-10-25T21:42:41.000Z 생성 시각
 * machineId 1 서버/노드 ID
 * sequence 1 같은 밀리초 내 두 번째 생성된 ID
 * 
 * Snowflake ID | 637491971203534849 
 * 생성 시각 (UTC) | 2025년 10월 25일 21:42:41
 * 머신 ID | 1
 * 시퀀스 번호 | 1
 */


export class CustomSnowflake {
	private static readonly EPOCH = 1609459200000n;
	private static sequence = 0n;
	private static lastTimestamp = 0n;
	private static machineId = 1n;

	static setMachineId(id: number | bigint) {
		this.machineId = BigInt(id);
	}

	private static getTimestamp(): bigint {
		return BigInt(Date.now());
	}

	static generate(): string {
		let timestamp = this.getTimestamp();

		if (timestamp < this.lastTimestamp)
			throw new Error("Clock moved backwards. Refusing to generate id.");

		if (timestamp === this.lastTimestamp) {
			this.sequence = (this.sequence + 1n) & 0xfffn;
			if (this.sequence === 0n)
				while (timestamp <= this.lastTimestamp)
					timestamp = this.getTimestamp();
		} else {
			this.sequence = 0n;
		}

		this.lastTimestamp = timestamp;

		const id =
			((timestamp - this.EPOCH) << 22n) |
			(this.machineId << 12n) |
			this.sequence;

		return id.toString();
	}
}

// 런타임에서 동적 설정
// CustomSnowflake.setMachineId(Number(process.env.MACHINE_ID ?? 1));
// console.log(CustomSnowflake.generate());
