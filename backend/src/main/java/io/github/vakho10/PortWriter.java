package io.github.vakho10;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.server.context.WebServerInitializedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

/**
 * Emits handshake signals to stdout once the embedded web server is up.
 * <p>
 * stdout is the <strong>only</strong> IPC channel between Java and Electron, so
 * nothing else may write to it — see {@code logback-spring.xml}, which routes
 * every log to a file, and {@code spring.main.banner-mode=off}.
 */
@Component
public class PortWriter implements ApplicationListener<WebServerInitializedEvent> {

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @Override
    public void onApplicationEvent(WebServerInitializedEvent event) {
        int port = event.getWebServer().getPort();

        // dev uses a fixed port the Electron side already knows; stage binds to
        // an OS-assigned port (server.port=0) that only Java can report back.
        if ("stage".equals(activeProfile)) {
            System.out.println("APP_PORT=" + port);
        }

        System.out.println("APP_READY");
        System.out.flush();
    }
}
