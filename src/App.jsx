/* eslint-disable react/prop-types */
import "./App.css";
import { React, useEffect, useState, useCallback } from "react";
import { Skeleton, Divider, message } from "antd";
import {
  MapContainer,
  TileLayer,
  Tooltip,
  Polygon,
  Popup,
  Marker,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import RankingList from "./components/RankingList/rankingList";
import MapController from "./components/MapController";
import WeightsForm from "./components/WeightsForm/WeightsForm";
import Legend from "./components/Legend/Legend";
import ZoomHandler from "./components/ZoomHandler";
const apiUrl =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://127.0.0.1:8000"
    : "https://calcommunity.onrender.com");

function App() {
  const [ranking, setRanking] = useState([]);
  const [community, setCommunity] = useState([]);

  const [services, setService] = useState([]);
  const [values, setValues] = useState({ crimes: 4, services: 4, income: 2 });
  const [position, setPosition] = useState([51.0447, -114.0719]);
  const [highlightedCommunity, setHighlightedCommunity] = useState();

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(13);

  const onCrimesChange = (value) => {
    setValues({
      ...values,
      crimes: value,
    });
  };
  const onServicesChange = (value) => {
    setValues({
      ...values,
      services: value,
    });
  };
  const onIncomeChange = (value) => {
    setValues({
      ...values,
      income: value,
    });
  };
  const onFinish = async () => {
    try {
      setLoading(true);
      const rankingResponse = await fetch(
        `${apiUrl}/api/v1/community-rank/`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            crimes: values.crimes,
            services: values.services,
            income: values.income,
          }),
        }
      );
      const rankingJson = await rankingResponse.json();
      const communityWithScores = community.reduce((acc, item) => {
        const match = rankingJson.data.find(rankingItem => rankingItem.id === item.id);
        acc.push({
          ...item,
          score: match.score,
          service_count: match.service_count,
        });
        return acc;
      }, []);
      setCommunity(communityWithScores)
      setRanking(rankingJson.data);
    } catch (error) {
      console.error("Error fetching ranking data:", error);
      message.error("Failed to fetch ranking data. Please try again later.");
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  const onFinishFailed = (errorInfo) => {
    console.log("Failed:", errorInfo);
  };
  useEffect(() => {
    const getData = async () => {
      const urls = [
         `${apiUrl}/api/v1/community/`,
         `${apiUrl}/api/v1/service/`,
         `${apiUrl}/api/v1/fetch-data/`,
      ];
      try {
        // render map first without waiting for ranking response
        const jsons = await Promise.all(
          urls.map(async (url) => {
            const resp = await fetch(url);
            const json = await resp.json();
            return json;
          })
        );
        setCommunity(jsons[0]);
        setService(jsons[1]);
        // async heavy computation
        setLoading(true);
        fetch(
           `${apiUrl}/api/v1/community-rank/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              crimes: values.crimes,
              services: values.services,
              income: values.income,
            }),
          }
        ).then((resp) => resp.json()).then((json) =>{
          const communityWithScores = jsons[0].reduce((acc, item) => {
            const match = json.data.find(rankingItem => rankingItem.id === item.id);
            acc.push({
              ...item,
              score: match.score,
              service_count: match.service_count,
            });
            return acc;
          }, []);
          setCommunity(communityWithScores)
          setRanking(json.data);
          setLoading(false);
        });
      } catch (error) {
        console.error("Error fetching data:", error);
        message.error("Failed to fetch data. Please try again later.");
        setError(error.message);
      }
    };
    getData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayCommunities = (comm) => {
    const results = comm.map(({ id, name, income, sector, multipolygon, score, service_count }, index) => {
      return (
        <Polygon
          key={index}
          weight={1}
          fillOpacity="0.4"
          pathOptions={{
            color:
              id == highlightedCommunity
                ? "white"
                : "#686868ff",
            weight: id == highlightedCommunity ? 5 : .6,
            fillColor: "rgb(138, 197, 143)",
          }}
          positions={multipolygon.coordinates}
        >
          <Tooltip sticky>
            <div className="">
              <span>{name}</span>
              <br />
              <span>{sector}</span>
              <br />
              {service_count && (<span>crimes :{service_count}</span>)}
              <br />
              <span>income :{income}</span>
              <br />
              {score && (<span>score :{(score * 1000).toFixed()}</span>)}
            </div>
          </Tooltip>
        </Polygon>
      );
    });
    return results;
  };
  const displayServices = (services) => {
    const transform = (type, { address, point: { coordinates }, name }) => {
      let icon;
      let showTitle;
      showTitle = zoomLevel >= 14;
      switch (type) {
        case "Hospital":
        case "PHS Clinic":
          icon = L.divIcon({
            html: `<div class='hospital'><span class='marker-title'  style='display: ${
              showTitle ? "block" : "none"
            };'>${name}</span></div>`,
          });
          break;
        case "Attraction":
          icon = L.divIcon({
            html: `<div class='attraction'><span class='marker-title'  style='display: ${
              showTitle ? "block" : "none"
            };'>${name}</span></div>`,
          });
          break;
        case "Library":
          icon = L.divIcon({
            html: `<div class='library'><span class='marker-title'  style='display: ${
              showTitle ? "block" : "none"
            };'>${name}</span></div>`,
          });
          break;
        default:
          icon = L.divIcon({
            html: `<div class='custom'><span class='marker-title'  style='display: ${
              showTitle ? "block" : "none"
            };'>${name}</span></div>`,
          });
          break;
      }
      return (
        <Marker position={coordinates} icon={icon}>
          <Popup>
            {name} <br /> {address}
            <br /> {type}
          </Popup>
        </Marker>
      );
    };
    const result = services.reduce(function (result, { type, ...rest }, index) {
      if (type !== "Community Centre") {
        result.push({
          index,
          ...transform(type, rest)
        });
      }
      return result;
    }, []);
    return result;
  };
  const handleZoomChange = useCallback((newZoom) => {
    setZoomLevel(newZoom);
  }, []);

  return (
    <div className="container">
      <div className="sidecar">
        <WeightsForm
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          values={values}
          onCrimesChange={onCrimesChange}
          onServicesChange={onServicesChange}
          onIncomeChange={onIncomeChange}
        />
        <Divider
          style={{
            fontSize: "12px",
            color: "rgb(126, 126, 126)",
            margin: "0px 0px 4px 0px",
            letterSpacing: "6px",
          }}
          orientation="left"
        >
          RANKING LIST
        </Divider>
        <div className="ranking-wrapper">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} loading={loading} active />
            ))
          ) : (
            <RankingList
              ranking={ranking}
              setPosition={setPosition}
              setHighlightedCommunity={setHighlightedCommunity}
              loading={loading}
            />
          )}
        </div>
      </div>
      <div className="my-map">
        <MapContainer
          center={[51.0447, -114.0719]}
          zoom={13}
          style={{
            height: "100vh",
            width: "100%",
            zIndex: 0,
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {displayCommunities(community)}
          {displayServices(services)}
          <MapController position={position} />
          <Legend />
          <ZoomHandler onZoomChange={handleZoomChange} />
        </MapContainer>
      </div>
    </div>
  );
}

export default App;