interface LoadingIndicatorProps {
  message?: string;
}

export default function LoadingIndicator({ message }: LoadingIndicatorProps) {
  return (
    <div className="flex flex-col justify-center items-center py-12 gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      {message && <p className="text-gray-600">{message}</p>}
    </div>
  );
}
