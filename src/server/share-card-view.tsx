/* eslint-disable @next/next/no-img-element -- next/og renders images, not browser elements. */
const ink = "#151b23";
const lime = "#edff70";
const white = "#f6f7f3";
export function ShareBrand({ logo }: { logo: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <img src={logo} width={64} height={64} alt="" />
      <div
        style={{
          display: "flex",
          fontSize: 36,
          fontWeight: 900,
          letterSpacing: -1,
        }}
      >
        Ting<span style={{ color: "#bdc4ce", marginLeft: 8 }}>map</span>
      </div>
    </div>
  );
}
export function MapShareCard({
  title,
  label,
  photo,
  logo,
}: {
  title: string;
  label: string;
  photo: string | null;
  logo: string;
}) {
  const size =
    title.length > 60
      ? 40
      : title.length > 38
        ? 52
        : title.length > 24
          ? 64
          : 80;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: ink,
        color: white,
        fontFamily: "SUIT",
        overflow: "hidden",
      }}
    >
      {photo && (
        <img
          src={photo}
          width={1200}
          height={630}
          alt=""
          style={{ position: "absolute", right: 0, top: 0 }}
        />
      )}
      {!photo && (
        <div
          style={{
            display: "flex",
            position: "absolute",
            width: 430,
            height: 430,
            right: -60,
            top: 90,
            border: "2px solid #edff7033",
            borderRadius: 215,
            transform: "rotate(-20deg)",
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 56,
          top: 48,
          width: 360,
          height: 64,
        }}
      >
        <ShareBrand logo={logo} />
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 58,
          top: 213,
          fontSize: 24,
          color: lime,
          fontWeight: 900,
        }}
      >
        {label || "함께 만드는 추천 지도"}
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 52,
          top: 261,
          width: 750,

          fontSize: size,
          fontWeight: 900,
          lineHeight: 1.15,
          letterSpacing: -2.8,
          wordBreak: "break-all",
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 58,
          bottom: 49,
          fontSize: 23,
          color: "#c8cdd2",
          letterSpacing: -0.4,
        }}
      >
        취향이 모이는 지도
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          right: 45,
          bottom: 46,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: lime,
          alignItems: "center",
          justifyContent: "center",
          color: ink,
          fontSize: 32,
        }}
      >
        ↗
      </div>
    </div>
  );
}
export function HomeShareCard({
  photos,
  logo,
}: {
  photos: string[];
  logo: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: ink,
        color: white,
        fontFamily: "SUIT",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 56,
          top: 48,
          width: 360,
          height: 64,
        }}
      >
        <ShareBrand logo={logo} />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: 52,
          top: 194,
          fontSize: 88,
          lineHeight: 1.11,
          fontWeight: 900,
          letterSpacing: -4,
        }}
      >
        <span>취향이</span>
        <span style={{ color: lime }}>모이는 지도</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: 57,
          bottom: 64,
          fontSize: 25,
          lineHeight: 1.5,
          color: "#c6ccd3",
          letterSpacing: -0.5,
        }}
      >
        <span>맛집부터 쇼핑, 여행까지.</span>
        <span>사람들의 추천으로 발견하는 다음 장소</span>
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 737,
          top: -9,
          width: 420,
          height: 282,
          borderRadius: 30,
          overflow: "hidden",
          transform: "rotate(8deg)",
          border: "2px solid #ffffff1c",
        }}
      >
        <img src={photos[0]} width={420} height={282} alt="" />
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 664,
          top: 316,
          width: 268,
          height: 351,
          borderRadius: 28,
          overflow: "hidden",
          transform: "rotate(-9deg)",
          border: "2px solid #ffffff1c",
        }}
      >
        <img src={photos[1]} width={268} height={351} alt="" />
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 974,
          top: 307,
          width: 268,
          height: 311,
          borderRadius: 28,
          overflow: "hidden",
          transform: "rotate(8deg)",
          border: "2px solid #ffffff1c",
        }}
      >
        <img src={photos[2]} width={268} height={311} alt="" />
      </div>
    </div>
  );
}
