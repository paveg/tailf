import './index.css'
import { Composition } from 'remotion'
import { TailfDemo } from './TailfDemo'

export const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id="TailfDemo"
			component={TailfDemo}
			durationInFrames={480}
			fps={30}
			width={1920}
			height={1080}
		/>
	)
}
