export default function Logo({ size = 60 }) {
  return (
    <img
      src="/images/logo.webp"
      alt="TUN Trip Logo"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover"
      }}
    />
  );
}
