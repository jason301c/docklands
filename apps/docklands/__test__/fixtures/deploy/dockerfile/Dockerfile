FROM busybox:1.37

WORKDIR /www
RUN echo "docklands dockerfile smoke" > index.html

EXPOSE 3000
CMD ["httpd", "-f", "-p", "3000", "-h", "/www"]
