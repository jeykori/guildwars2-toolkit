import { useEffect } from "react";

export default function NotFoundPage() {
	useEffect(() => {
		document.title = `Page Not Found`;
	}, []);

	return (
		<div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-4">
			<h1 className="text-6xl font-extrabold tracking-tight">404</h1>
			<p className="text-xl text-muted-foreground">
				The page you are looking for does not exist.
			</p>
		</div>
	);
}
