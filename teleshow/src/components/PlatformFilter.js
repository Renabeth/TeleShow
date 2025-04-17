import React, { useEffect } from "react";
import Form from "react-bootstrap/Form";
import { Row, Col } from "react-bootstrap";

const supported_platforms = [
  { id: "netflix", name: "Netflix" },
  { id: "hulu", name: "Hulu" },
  { id: "disney", name: "Disney+" },
  { id: "amazon", name: "Amazon Prime" },
  { id: "max", name: "HBO Max" },
  { id: "apple", name: "Apple TV+" },
  { id: "paramount", name: "Paramount+" },
  { id: "peacock", name: "Peacock" },
  { id: "google", name: "Google" },
];
export const updateSelectedPlatforms = (platform, prevSelectedPlatforms) => {
  //https://support.syncfusion.com/kb/article/18693/updating-state-value-of-checkbox-in-a-react-menu-template
  //https://intellipaat.com/blog/react-checkbox/
  //Using REACT state Update pattern
  //Gets the previous value of the usestate variable
  //if the platform is all its set to all
  //if not then a new selection is made and added to the array of platforms.
  //Selecting the same platform twice removes from selection
  if (platform === "all") {
    return prevSelectedPlatforms.includes("all") ? [] : ["all"];
  } else {
    if (prevSelectedPlatforms.includes("all")) {
      return [platform];
    }

    let newSelection = prevSelectedPlatforms.includes(platform)
      ? prevSelectedPlatforms.filter((p) => p !== platform)
      : //takes the old filters and adds the new platform to them.
        [...prevSelectedPlatforms.filter((p) => p !== "all"), platform];

    return newSelection;
  }
};

function PlatformFilter({
  selectedPlatforms,
  onPlatformChange,
  title = "Filter by Streaming Platforms:",
}) {
  const handlePlatformChange = (platform) => {
    if (onPlatformChange) {
      onPlatformChange(platform);
    }
  };

  return (
    <div className="platform-filter-container">
      <h5>{title}</h5>
      <Form>
        <Row>
          <Col xs={12}>
            <Form.Check
              type="checkbox"
              id="platform-all"
              label="All Platforms"
              checked={selectedPlatforms.includes("all")}
              onChange={() => handlePlatformChange("all")}
              className="mb-2"
            />
          </Col>
          {supported_platforms.map((platform) => (
            <Col xs={6} md={4} key={platform.id}>
              <Form.Check
                type="checkbox"
                id={`platform-${platform.id}`}
                label={platform.name}
                checked={selectedPlatforms.includes(platform.id)}
                onChange={() => handlePlatformChange(platform.id)}
                disabled={selectedPlatforms.includes("all")}
                className="mb-2"
              />
            </Col>
          ))}
        </Row>
      </Form>
    </div>
  );
}

export default PlatformFilter;
