interface ErrorMessageProps {
  title?: string;
  message: string;
}

export default function ErrorMessage({
  title = '오류',
  message,
}: ErrorMessageProps) {
  return (
    <div className="mb-6 p-4 bg-red-100 border border-red-400 rounded-lg text-red-700">
      <p className="font-semibold">{title}</p>
      <p>{message}</p>
    </div>
  );
}
