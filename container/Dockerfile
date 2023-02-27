FROM gcr.io/chromesedge/googlechromestable:latest

ENV NODE_ENV=production
ENV DISPLAY :99
WORKDIR /usr/src/app
EXPOSE 5900

COPY . .

RUN npm install
RUN cd core && npm install


CMD node server.js